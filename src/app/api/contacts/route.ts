import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { sendTelegramMessage } from "@/lib/telegram";

const emailSchema = z.object({
  type: z.literal("EMAIL").optional(),
  value: z.string().email("Некорректный email"),
});

const telegramSchema = z.object({
  type: z.literal("TELEGRAM"),
  // chat id — целое число (может быть отрицательным для групп).
  value: z
    .string()
    .trim()
    .regex(/^-?\d+$/, "Chat id должен быть числом. Получите его у бота."),
});

const schema = z.union([telegramSchema, emailSchema]);

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const type = parsed.data.type ?? "EMAIL";
  const value =
    type === "EMAIL" ? parsed.data.value.trim().toLowerCase() : parsed.data.value.trim();

  const existing = await prisma.contact.findFirst({
    where: { userId, value, type },
  });
  if (existing) {
    return NextResponse.json({ error: "Такой контакт уже добавлен" }, { status: 409 });
  }

  const contact = await prisma.contact.create({
    data: { userId, type, value, verified: true },
  });

  // Для Telegram сразу отправляем приветственное сообщение — так пользователь
  // видит, что chat id указан верно и алерты будут доходить.
  if (type === "TELEGRAM") {
    await sendTelegramMessage(
      value,
      "✅ Telegram подключён к <b>Logsy</b>. Сюда будут приходить алерты о падении мониторов и SSL.",
      { html: true },
    ).catch(() => {});
  }

  return NextResponse.json({ contact });
}
