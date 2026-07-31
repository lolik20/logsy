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
import { sendMail } from "@/lib/mailer";

const API_BASE = "https://api.telegram.org";

// Префикс callback_data кнопки «Игнорировать ошибку»: "ig:<id токена>". Сам URL правила
// в callback_data не помещается (лимит Telegram — 64 байта), поэтому в кнопке едет только
// короткий id строки TgIgnoreToken, где хранится описание правила (см. schema.prisma).
const IGNORE_PREFIX = "ig:";

// Префикс callback_data кнопки «Ответить на почту»: "rp:<id токена TgReplyToken>".
const REPLY_PREFIX = "rp:";

/** callback_data для кнопки «Игнорировать ошибку» по id токена TgIgnoreToken. */
export function ignoreCallbackData(tokenId: string): string {
  return `${IGNORE_PREFIX}${tokenId}`;
}

/** callback_data для кнопки «Ответить на почту» по id токена TgReplyToken. */
export function replyCallbackData(tokenId: string): string {
  return `${REPLY_PREFIX}${tokenId}`;
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
  opts: SendOptions = {},
): Promise<boolean> {
  return (await sendMessage(chatId, text, opts)).ok;
}

/**
 * То же, что sendTelegramMessage, но возвращает message_id отправленного сообщения
 * (или null, если отправить не удалось либо бот не настроен). Нужен там, где на
 * сообщение потом отвечают: по паре (chat id, message id) бот узнаёт, к какому
 * обращению относится ответ владельца (см. TgReplyToken).
 */
export async function sendTelegramMessageWithId(
  chatId: string,
  text: string,
  opts: SendOptions = {},
): Promise<number | null> {
  return (await sendMessage(chatId, text, opts)).messageId;
}

/** Параметры отправки: HTML-разметка, инлайн-кнопки, приглашение ответить (force_reply). */
type SendOptions = { html?: boolean; replyMarkup?: InlineKeyboard; forceReply?: boolean };

/** Общая реализация отправки: ok — ушло ли сообщение, messageId — его id (если известен). */
async function sendMessage(
  chatId: string,
  text: string,
  opts: SendOptions,
): Promise<{ ok: boolean; messageId: number | null }> {
  if (!getBotToken()) {
    console.log(
      "\n===== [Logsy] TELEGRAM (бот не настроен, вывод в консоль) =====\n" +
        `Chat ID: ${chatId}\n` +
        `---\n${text}\n` +
        (opts.replyMarkup ? `[кнопки: ${opts.replyMarkup.flat().map((b) => b.text).join(", ")}]\n` : "") +
        "==============================================================\n",
    );
    return { ok: true, messageId: null };
  }

  const params: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  };
  if (opts.html) params.parse_mode = "HTML";
  if (opts.replyMarkup) params.reply_markup = { inline_keyboard: opts.replyMarkup };
  // force_reply открывает у владельца поле ответа на это сообщение — так его текст
  // придёт нам как reply и будет распознан (взаимоисключимо с инлайн-клавиатурой).
  else if (opts.forceReply) params.reply_markup = { force_reply: true };

  const res = await telegramApi<{ message_id?: number }>("sendMessage", params);
  return { ok: res !== null, messageId: res?.message_id ?? null };
}

/**
 * Заменяет инлайн-клавиатуру уже отправленного сообщения. Нужен, когда кнопку можно
 * собрать только после отправки — например, кнопка «Ответить на почту» ссылается на
 * токен, который заводится по message_id самого оповещения (см. user-report.ts).
 */
export async function setTelegramReplyMarkup(
  chatId: string,
  messageId: number,
  keyboard: InlineKeyboard,
): Promise<boolean> {
  if (!getBotToken()) return true;
  const res = await telegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: keyboard },
  });
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
  // Сообщение, на которое отвечают. По его message_id бот понимает, что владелец
  // отвечает на оповещение о сообщении посетителя (см. handleReplyToReport).
  reply_to_message?: TgMessage;
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
 * Нажатие инлайн-кнопки: «Игнорировать ошибку» (ig:) — заводит правило игнор-листа,
 * «Ответить на почту» (rp:) — присылает приглашение написать ответ посетителю.
 */
async function handleCallbackQuery(cb: TgCallbackQuery): Promise<void> {
  const data = cb.data ?? "";
  const fromChatId = cb.from?.id != null ? String(cb.from.id) : null;

  if (data.startsWith(IGNORE_PREFIX)) {
    const message = await ignoreErrorFromToken(data.slice(IGNORE_PREFIX.length), fromChatId);
    // show_alert=true — показать текст модалкой (заметнее, чем всплывашка), т.к. это итог действия.
    await answerCallbackQuery(cb.id, message, true);
    return;
  }
  if (data.startsWith(REPLY_PREFIX)) {
    const message = await promptEmailReply(data.slice(REPLY_PREFIX.length), fromChatId);
    await answerCallbackQuery(cb.id, message ?? undefined, message !== null);
    return;
  }
  // Незнакомый callback — просто гасим «часики», чтобы кнопка не висела в загрузке.
  await answerCallbackQuery(cb.id);
}

/**
 * Кнопка «Ответить на почту»: присылает в чат приглашение написать ответ (force_reply) и
 * привязывает его к тому же обращению — ответ на это приглашение уйдёт письмом посетителю
 * (см. handleReplyToReport). Возвращает текст ошибки для всплывашки либо null, если всё
 * прошло успешно (тогда пояснение уже пришло отдельным сообщением).
 */
async function promptEmailReply(
  tokenId: string,
  fromChatId: string | null,
): Promise<string | null> {
  if (!tokenId) return "Не удалось распознать действие.";

  const token = await prisma.tgReplyToken.findUnique({ where: { id: tokenId } });
  if (!token) return "Кнопка устарела — ответить на это обращение уже нельзя.";
  if (!fromChatId || fromChatId !== token.chatId) {
    return "Нет доступа: это оповещение адресовано другому чату.";
  }

  const messageId = await sendTelegramMessageWithId(
    token.chatId,
    `✍️ Напишите ответ для <b>${escapeHtml(token.email)}</b> — ответом (reply) на это сообщение. ` +
      `Текст уйдёт посетителю письмом от имени проекта.`,
    { html: true, forceReply: true },
  );
  if (messageId == null) return "Не удалось отправить приглашение. Попробуйте позже.";

  // Приглашение — ещё одна точка ответа на то же обращение: копируем токен на него.
  await prisma.tgReplyToken.create({
    data: {
      projectId: token.projectId,
      taskId: token.taskId,
      email: token.email,
      chatId: token.chatId,
      messageId,
    },
  });
  return null;
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
 * число пользователь вставляет в панели на вкладке «Контакты». Исключение — ответ
 * (reply) на оповещение о сообщении посетителя: такой текст уходит письмом ему
 * (см. handleReplyToReport).
 */
async function handleMessage(update: TgUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chat = message?.chat;
  if (!chat?.id) return;

  // Ответы обрабатываем только у новых сообщений: правка уже отправленного ответа
  // не должна отправлять посетителю второе письмо.
  if (update.message && (await handleReplyToReport(update.message))) return;

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

// ------------------------- Ответ посетителю письмом из Telegram -------------------------

/** Максимальная длина ответа — как в форме переписки задачи (/api/tasks/[id]/messages). */
const MAX_REPLY_CHARS = 4000;

/**
 * Ответ (reply) владельца на оповещение о сообщении посетителя: отправляем текст письмом
 * на почту обращения и дописываем в переписку задачи как OUTGOING — ровно то же, что даёт
 * ответ из карточки задачи в панели. Возвращает true, если сообщение было таким ответом и
 * обработано (тогда обычную подсказку с chat id слать не нужно).
 *
 * Авторизация: обращение ищется по паре (chat id, message id), а оповещение уходило только
 * в чат владельца — значит, ответить может лишь тот, кому оно пришло. Пересланная копия
 * лежит в другом чате и по этому ключу не находится.
 */
async function handleReplyToReport(message: TgMessage): Promise<boolean> {
  const chatId = message.chat?.id != null ? String(message.chat.id) : null;
  const replyToId = message.reply_to_message?.message_id;
  if (!chatId || replyToId == null) return false;

  const token = await prisma.tgReplyToken.findUnique({
    where: { chatId_messageId: { chatId, messageId: replyToId } },
    include: {
      project: {
        select: { name: true, domain: true, user: { select: { email: true } } },
      },
    },
  });
  if (!token) return false;

  const body = (message.text ?? "").trim().slice(0, MAX_REPLY_CHARS);
  if (!body) {
    await sendTelegramMessage(chatId, "Пустой ответ — напишите текст письма посетителю.");
    return true;
  }

  // Письмо уходит с технического SMTP_FROM, но Reply-To ставим на почту владельца
  // проекта — так прямой ответ посетителя придёт ему (как и в переписке по задаче).
  const ownerEmail = token.project.user.email;
  try {
    await sendMail({
      to: token.email,
      subject: `Ответ по вашему обращению · ${token.project.name}`,
      text: `${body}\n\n— поддержка проекта ${token.project.name} (${token.project.domain})`,
      replyTo: ownerEmail || undefined,
    });
  } catch (err) {
    console.error("[Logsy] Не удалось отправить ответ посетителю из Telegram:", err);
    await sendTelegramMessage(
      chatId,
      `⚠️ Не удалось отправить письмо на ${token.email}. Попробуйте ещё раз позже или ответьте из панели.`,
    );
    return true;
  }

  // Переписка задачи — не критично для доставки письма, поэтому ошибку только логируем.
  if (token.taskId) {
    await prisma.taskMessage
      .create({
        data: {
          taskId: token.taskId,
          direction: "OUTGOING",
          body,
          fromEmail: ownerEmail || null,
          toEmail: token.email,
        },
      })
      .catch((err) =>
        console.error("[Logsy] Не удалось сохранить ответ из Telegram в переписку задачи:", err),
      );
  }

  await sendTelegramMessage(
    chatId,
    `✅ Ответ отправлен на <b>${escapeHtml(token.email)}</b>` +
      (token.taskId ? " и сохранён в переписке задачи." : "."),
    { html: true },
  );
  return true;
}

/**
 * Регистрирует сообщение оповещения как точку ответа посетителю: ответ (reply) на него в
 * Telegram уйдёт письмом на email. Вызывается после отправки оповещения о сообщении из
 * обратной формы (см. src/lib/user-report.ts). Возвращает id созданного токена — его
 * кладут в callback_data кнопки «Ответить на почту».
 */
export async function registerReplyTarget(params: {
  projectId: string;
  taskId: string | null;
  email: string;
  chatId: string;
  messageId: number;
}): Promise<string | null> {
  try {
    const token = await prisma.tgReplyToken.create({ data: params, select: { id: true } });
    return token.id;
  } catch (err) {
    console.error("[Logsy] Не удалось привязать ответ из Telegram к обращению:", err);
    return null;
  }
}
