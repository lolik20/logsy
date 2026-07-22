/**
 * Интеграция с Telegram Bot API для алертов — на long polling через прокси.
 *
 * Бот работает без публичного webhook: долгоживущий процесс (воркер или сервер
 * Next.js) сам опрашивает Telegram методом getUpdates. Это удобно, когда сайт
 * недоступен извне, а сам Telegram — из-за блокировок — доступен только через
 * прокси (TELEGRAM_PROXY_URL).
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN    — токен бота от @BotFather (обязателен).
 *   TELEGRAM_PROXY_URL    — HTTP(S)-прокси до api.telegram.org (необязателен),
 *                           напр. http://user:pass@host:3128.
 *   TELEGRAM_BOT_USERNAME — username бота без @ (необязателен; если не задан,
 *                           берётся автоматически из getMe).
 */
import { ProxyAgent, type Dispatcher } from "undici";
import { prisma } from "@/lib/prisma";

const API_BASE = "https://api.telegram.org";

// Префикс callback_data кнопки «Игнорировать ошибку»: "ig:<id токена>". Сам URL правила
// в callback_data не помещается (лимит Telegram — 64 байта), поэтому в кнопке едет только
// короткий id строки TgIgnoreToken, где хранится описание правила (см. schema.prisma).
const IGNORE_PREFIX = "ig:";

/** callback_data для кнопки «Игнорировать ошибку» по id токена TgIgnoreToken. */
export function ignoreCallbackData(tokenId: string): string {
  return `${IGNORE_PREFIX}${tokenId}`;
}

/** Кнопка инлайн-клавиатуры: либо callback (обрабатывается ботом), либо ссылка. */
export type InlineButton =
  | { text: string; callback_data: string }
  | { text: string; url: string };
/** Инлайн-клавиатура: строки кнопок (reply_markup.inline_keyboard). */
export type InlineKeyboard = InlineButton[][];

/** Токен бота из окружения (или null, если не настроен). */
export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

// Прокси-диспетчер для fetch (создаётся один раз). Если прокси не задан —
// undefined, и запросы идут напрямую.
let dispatcher: ProxyAgent | undefined;
let dispatcherReady = false;
function getDispatcher(): Dispatcher | undefined {
  if (!dispatcherReady) {
    dispatcherReady = true;
    const url = process.env.TELEGRAM_PROXY_URL;
    if (url) dispatcher = new ProxyAgent(url);
  }
  return dispatcher;
}

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

/**
 * Вызывает метод Bot API. Возвращает result или null при ошибке.
 * timeoutMs должен быть больше, чем long-poll timeout в getUpdates.
 */
async function telegramApi<T>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 15000,
): Promise<T | null> {
  const token = getBotToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
      // dispatcher — расширение undici (глобальный fetch в Node), нет в типах DOM.
      dispatcher: getDispatcher(),
    } as RequestInit & { dispatcher?: Dispatcher });

    const data = (await res.json().catch(() => null)) as TgResponse<T> | null;
    if (!res.ok || !data?.ok) {
      console.error(
        `[Logsy] Telegram ${method} → ${res.status}: ${data?.description ?? "нет тела"}`,
      );
      return null;
    }
    return data.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------ Отправка алертов ------------------------------

/** Экранирует спецсимволы HTML для parse_mode=HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Отправляет сообщение в Telegram-чат по chat id. Если токен не настроен —
 * пишет в консоль и возвращает true (dev-режим, по аналогии с mailer.ts).
 *
 * По умолчанию текст уходит как обычный (без parse_mode) — это важно для
 * алертов, куда попадает тело ответа проверяемого сайта (напр. `<!doctype html>`):
 * с parse_mode=HTML Telegram отверг бы такое сообщение с ошибкой 400. HTML-режим
 * включается только для наших собственных сообщений через opts.html, и всё
 * динамическое в них нужно пропускать через escapeHtml.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  opts: { html?: boolean; replyMarkup?: InlineKeyboard } = {},
): Promise<boolean> {
  if (!getBotToken()) {
    console.log(
      "\n===== [Logsy] TELEGRAM (бот не настроен, вывод в консоль) =====\n" +
        `Chat ID: ${chatId}\n` +
        `---\n${text}\n` +
        (opts.replyMarkup ? `[кнопки: ${opts.replyMarkup.flat().map((b) => b.text).join(", ")}]\n` : "") +
        "==============================================================\n",
    );
    return true;
  }

  const params: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (opts.html) params.parse_mode = "HTML";
  if (opts.replyMarkup) params.reply_markup = { inline_keyboard: opts.replyMarkup };

  const res = await telegramApi("sendMessage", params);
  return res !== null;
}

/** Подтверждает нажатие инлайн-кнопки (убирает «часики»); text — всплывающее уведомление. */
async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  await telegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
    show_alert: showAlert,
  });
}

// ------------------------------- Данные о боте --------------------------------

type BotInfo = { username?: string };
let cachedUsername: string | null | undefined;

/**
 * Username бота (без @) для ссылки t.me/<username>. Берётся из
 * TELEGRAM_BOT_USERNAME, иначе — один раз запрашивается через getMe и кэшируется.
 */
export async function getBotUsername(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (fromEnv) return fromEnv;
  if (!getBotToken()) return null;
  if (cachedUsername !== undefined) return cachedUsername;

  const me = await telegramApi<BotInfo>("getMe");
  cachedUsername = me?.username ?? null;
  return cachedUsername;
}

/** Ссылка на бота для кнопки «Открыть бота» (или null, если бот не настроен). */
export async function getBotLink(): Promise<string | null> {
  const username = await getBotUsername();
  return username ? `https://t.me/${username}` : null;
}

// ------------------------------- Long polling --------------------------------

interface TgChat {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}
interface TgMessage {
  message_id?: number;
  chat?: TgChat;
  text?: string;
}
interface TgCallbackQuery {
  id: string;
  // Отправитель нажатия. В личном чате его id совпадает с chat id — по нему авторизуем.
  from?: { id: number };
  message?: TgMessage;
  data?: string;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

let polling = false;

/**
 * Запускает бесконечный цикл long polling (getUpdates). Идемпотентно: повторные
 * вызовы игнорируются. Внутри одного аккаунта getUpdates должен выполнять только
 * один процесс — иначе Telegram вернёт 409 Conflict.
 */
export function startTelegramPolling(): void {
  if (polling) return;
  if (!getBotToken()) {
    console.log("[Logsy] Telegram: токен не задан, long polling выключен.");
    return;
  }
  polling = true;
  console.log(
    "[Logsy] Telegram long polling запущен" +
      (process.env.TELEGRAM_PROXY_URL ? " (через прокси)" : ""),
  );
  void pollLoop();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pollLoop(): Promise<void> {
  // offset = update_id последнего обработанного апдейта + 1. Стартуем с 0:
  // Telegram отдаст накопившийся backlog, который мы сразу подтвердим.
  let offset = 0;
  const LONG_POLL_S = 30;

  while (polling) {
    try {
      const updates = await telegramApi<TgUpdate[]>(
        "getUpdates",
        { offset, timeout: LONG_POLL_S, allowed_updates: ["message", "callback_query"] },
        (LONG_POLL_S + 10) * 1000,
      );
      if (!updates) {
        // Ошибка запроса (в т.ч. таймаут/прокси) — небольшая пауза и повтор.
        await sleep(5000);
        continue;
      }
      for (const u of updates) {
        offset = u.update_id + 1;
        await handleUpdate(u).catch((e) =>
          console.error("[Logsy] Telegram: обработка апдейта:", e),
        );
      }
    } catch (err) {
      console.error("[Logsy] Telegram getUpdates:", err);
      await sleep(5000);
    }
  }
}

/**
 * Обрабатывает один апдейт: нажатие инлайн-кнопки (callback_query) — отдельно, обычное
 * сообщение — ответом с chat id (см. handleMessage).
 */
async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }
  await handleMessage(update);
}

/**
 * Нажатие инлайн-кнопки «Игнорировать ошибку». data = "ig:<id токена>". Находим токен,
 * проверяем, что нажал владелец проекта (его Telegram привязан контактом), и заводим
 * правило в игнор-листе проекта. Действие идемпотентно: повторное нажатие ничего не ломает.
 */
async function handleCallbackQuery(cb: TgCallbackQuery): Promise<void> {
  const data = cb.data ?? "";
  if (!data.startsWith(IGNORE_PREFIX)) {
    // Незнакомый callback — просто гасим «часики», чтобы кнопка не висела в загрузке.
    await answerCallbackQuery(cb.id);
    return;
  }
  const tokenId = data.slice(IGNORE_PREFIX.length);
  const fromChatId = cb.from?.id != null ? String(cb.from.id) : null;
  const message = await ignoreErrorFromToken(tokenId, fromChatId);
  // show_alert=true — показать текст модалкой (заметнее, чем всплывашка), т.к. это итог действия.
  await answerCallbackQuery(cb.id, message, true);
}

/**
 * Заводит правило игнор-листа по токену кнопки. Возвращает текст для ответа пользователю.
 * Токен не удаляем: повторное нажатие идемпотентно (upsert), а протухшие токены чистит
 * purgeExpiredLogs. Авторизация: нажать может только тот, чей chat id сохранён контактом
 * Telegram у владельца проекта — иначе пересланное сообщение позволило бы менять чужой проект.
 */
async function ignoreErrorFromToken(
  tokenId: string,
  fromChatId: string | null,
): Promise<string> {
  if (!tokenId) return "Не удалось распознать действие.";

  const token = await prisma.tgIgnoreToken.findUnique({
    where: { id: tokenId },
    include: { project: { select: { id: true, userId: true, name: true } } },
  });
  if (!token) return "Кнопка устарела — это оповещение больше неактуально.";

  const authorized = fromChatId
    ? await prisma.contact.findFirst({
        where: { userId: token.project.userId, type: "TELEGRAM", value: fromChatId },
        select: { id: true },
      })
    : null;
  if (!authorized) return "Нет доступа: этот проект не привязан к вашему Telegram.";

  // Идемпотентно: пара (проект, категория, режим, url) уникальна (см. /api/logger/exceptions).
  await prisma.logException.upsert({
    where: {
      projectId_kind_urlMode_url: {
        projectId: token.projectId,
        kind: token.kind,
        urlMode: token.urlMode,
        url: token.url,
      },
    },
    create: {
      projectId: token.projectId,
      kind: token.kind,
      urlMode: token.urlMode,
      url: token.url,
    },
    update: {},
  });

  return (
    `✅ Ошибка добавлена в исключения проекта «${token.project.name}». ` +
    `Похожие события больше не сохраняются и не присылают оповещений. ` +
    `Снять правило можно в панели Logsy на вкладке «Логи».`
  );
}

/**
 * Отвечает пользователю его chat id (по /start или любому сообщению). Именно это
 * число пользователь вставляет в панели на вкладке «Контакты».
 */
async function handleMessage(update: TgUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chat = message?.chat;
  if (!chat?.id) return;

  const name = escapeHtml(
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      chat.username ||
      "друг",
  );

  const text =
    `Привет, ${name}! 👋\n\n` +
    `Это бот алертов <b>Logsy</b>.\n\n` +
    `Ваш chat id:\n<b><code>${chat.id}</code></b>\n\n` +
    `Скопируйте его и вставьте в панели Logsy на вкладке «Контакты», ` +
    `чтобы получать сюда уведомления о падении сайтов и SSL.`;

  await sendTelegramMessage(String(chat.id), text, { html: true });
}
