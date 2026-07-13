import { NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

/**
 * Webhook Telegram-бота. Когда пользователь открывает бота и нажимает
 * «Запустить» (/start) или пишет любое сообщение, бот отвечает его chat id —
 * это число пользователь копирует и добавляет в панели («Алерты»).
 *
 * Установка webhook (однократно):
 *   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 */
export async function POST(req: Request) {
  // Telegram присылает секрет в заголовке, если он задан при setWebhook.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get("x-telegram-bot-api-secret-token");
    if (got !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = await req.json().catch(() => null);
  const message = update?.message ?? update?.edited_message;
  const chat = message?.chat;
  const chatId = chat?.id;

  // Не сообщение с чатом — просто подтверждаем приём, чтобы Telegram не ретраил.
  if (!chatId) return NextResponse.json({ ok: true });

  const name: string =
    [chat?.first_name, chat?.last_name].filter(Boolean).join(" ") ||
    chat?.username ||
    "друг";

  const text =
    `Привет, ${name}! 👋\n\n` +
    `Это бот алертов <b>Logsy</b>.\n\n` +
    `Ваш chat id:\n<b><code>${chatId}</code></b>\n\n` +
    `Скопируйте его и вставьте в панели Logsy на вкладке «Алерты», ` +
    `чтобы получать сюда уведомления о падении сайтов и SSL.`;

  await sendTelegramMessage(String(chatId), text);

  return NextResponse.json({ ok: true });
}

// Удобно для быстрой проверки, что эндпоинт поднят.
export async function GET() {
  return NextResponse.json({ ok: true, service: "telegram-webhook" });
}
