/**
 * Интеграция с Telegram Bot API для алертов.
 *
 * Токен бота задаётся в TELEGRAM_BOT_TOKEN, имя (username) бота — в
 * TELEGRAM_BOT_USERNAME (без @). Если токен не настроен, сообщения выводятся в
 * консоль сервера (dev-режим), по аналогии с mailer.ts.
 */

const API_BASE = "https://api.telegram.org";

/** Токен бота из окружения (или null, если не настроен). */
export function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null;
}

/** Username бота (без @) для ссылки t.me/<username>. */
export function getBotUsername(): string | null {
  return process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "") || null;
}

/** Ссылка на бота для кнопки «Подключить Telegram». */
export function getBotLink(): string | null {
  const username = getBotUsername();
  return username ? `https://t.me/${username}` : null;
}

/**
 * Отправляет сообщение в Telegram-чат по chat id через Bot API. Если токен не
 * настроен — пишет в консоль и возвращает true (dev-режим).
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
): Promise<boolean> {
  const token = getBotToken();

  if (!token) {
    console.log(
      "\n===== [Logsy] TELEGRAM (бот не настроен, вывод в консоль) =====\n" +
        `Chat ID: ${chatId}\n` +
        `---\n${text}\n` +
        "==============================================================\n",
    );
    return true;
  }

  try {
    const res = await fetch(`${API_BASE}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(
        `[Logsy] Telegram sendMessage → ${res.status}: ${body.slice(0, 300)}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Logsy] Ошибка отправки сообщения в Telegram:", err);
    return false;
  }
}
