import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generatePassword, hashPassword } from "@/lib/password";
import { sendMail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email("Некорректный email"),
  name: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Пользователь с таким email уже зарегистрирован" },
      { status: 409 },
    );
  }

  // Пароль генерируется на бэке и отправляется пользователю на почту.
  const password = generatePassword(12);
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      subscription: {
        create: { plan: "FREE", sitesLimit: 1, priceRub: 300, status: "inactive" },
      },
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  await sendMail({
    to: email,
    subject: "Доступ к Logsy — ваш пароль",
    text:
      `Здравствуйте!\n\n` +
      `Вы зарегистрировались в Logsy — сервисе мониторинга доступности сайтов.\n\n` +
      `Данные для входа:\n` +
      `  Логин (email): ${email}\n` +
      `  Пароль: ${password}\n\n` +
      `Войти: ${appUrl}/login\n\n` +
      `Рекомендуем сменить пароль после первого входа.\n` +
      `— Команда Logsy`,
  });

  return NextResponse.json({ ok: true });
}
