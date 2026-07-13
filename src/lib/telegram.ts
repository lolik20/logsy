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

const API_BASE = "https://api.telegram.org";

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

/**
 * Отправляет сообщение в Telegram-чат по chat id. Если токен не настроен —
 * пишет в консоль и возвращает true (dev-режим, по аналогии с mailer.ts).
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  if (!getBotToken()) {
    console.log(
      "\n===== [Logsy] TELEGRAM (бот не настроен, вывод в консоль) =====\n" +
        `Chat ID: ${chatId}\n` +
        `---\n${text}\n` +
        "==============================================================\n",
    );
    return true;
  }

  const res = await telegramApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
  return res !== null;
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
  chat?: TgChat;
  text?: string;
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
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
        { offset, timeout: LONG_POLL_S, allowed_updates: ["message"] },
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
 * Отвечает пользователю его chat id (по /start или любому сообщению). Именно это
 * число пользователь вставляет в панели на вкладке «Алерты».
 */
async function handleUpdate(update: TgUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chat = message?.chat;
  if (!chat?.id) return;

  const name =
    [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
    chat.username ||
    "друг";

  const text =
    `Привет, ${name}! 👋\n\n` +
    `Это бот алертов <b>Logsy</b>.\n\n` +
    `Ваш chat id:\n<b><code>${chat.id}</code></b>\n\n` +
    `Скопируйте его и вставьте в панели Logsy на вкладке «Алерты», ` +
    `чтобы получать сюда уведомления о падении сайтов и SSL.`;

  await sendTelegramMessage(String(chat.id), text);
}
