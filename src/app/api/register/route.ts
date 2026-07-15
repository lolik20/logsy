import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generatePassword, hashPassword } from "@/lib/password";
import { createQuickAuthToken, buildQuickAuthUrl } from "@/lib/quick-auth";
import { sendMail } from "@/lib/mailer";
import { getClientIp } from "@/lib/request-ip";
import { FREE_SITES_LIMIT } from "@/lib/subscription";

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

  // IP регистрации сохраняем для антифрод-аналитики, но сам по себе он
  // больше не ограничивает создание аккаунта — контроль повторов перенесён
  // на уровень проектов (по домену) при создании сайта.
  const ip = getClientIp(req);

  // Пароль генерируется на бэке и отправляется пользователю на почту.
  const password = generatePassword(12);
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      signupIp: ip,
      subscription: {
        create: {
          plan: "FREE",
          sitesLimit: FREE_SITES_LIMIT,
          priceRub: 0,
          status: "active",
        },
      },
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";

  // Ссылка для быстрой авторизации: одноразовый вход без ввода пароля.
  const quickToken = await createQuickAuthToken(email);
  const quickAuthUrl = buildQuickAuthUrl(appUrl, quickToken);

  await sendMail({
    to: email,
    subject: "Доступ к Logsy — ваш пароль",
    text:
      `Здравствуйте!\n\n` +
      `Вы зарегистрировались в Logsy — сервисе мониторинга доступности сайтов.\n\n` +
      `Каждый проект работает на бесплатном тарифе: до 300 сессий в сутки ` +
      `и хранение логов 12 часов. Платный тариф можно подключить в любой момент.\n\n` +
      `Быстрый вход (по ссылке, без пароля, действует 24 часа):\n` +
      `  ${quickAuthUrl}\n\n` +
      `Данные для входа вручную:\n` +
      `  Логин (email): ${email}\n` +
      `  Пароль: ${password}\n\n` +
      `Войти: ${appUrl}/login\n\n` +
      `Рекомендуем сменить пароль после первого входа.\n` +
      `— Команда Logsy`,
  });

  return NextResponse.json({ ok: true });
}
