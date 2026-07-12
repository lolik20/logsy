import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generatePassword, hashPassword } from "@/lib/password";
import { sendMail } from "@/lib/mailer";
import { getClientIp } from "@/lib/request-ip";
import { TRIAL_DAYS, TRIAL_SITES_LIMIT, trialEndFrom } from "@/lib/subscription";

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

  // Антифрод: не выдаём повторный бесплатный период с одного IP.
  // Если с этого адреса уже регистрировался аккаунт (и получал триал) —
  // просим оформить подписку вместо создания нового аккаунта.
  const ip = getClientIp(req);
  if (ip) {
    const usedFromIp = await prisma.user.count({ where: { signupIp: ip } });
    if (usedFromIp > 0) {
      return NextResponse.json(
        {
          error:
            "С этого устройства уже был активирован бесплатный период. " +
            "Оформите подписку или войдите в существующий аккаунт.",
        },
        { status: 429 },
      );
    }
  }

  // Пароль генерируется на бэке и отправляется пользователю на почту.
  const password = generatePassword(12);
  const passwordHash = await hashPassword(password);

  // Пробный период: 2 недели на 1 сайт бесплатно.
  const trialEnd = trialEndFrom();

  await prisma.user.create({
    data: {
      email,
      name: parsed.data.name?.trim() || null,
      passwordHash,
      signupIp: ip,
      subscription: {
        create: {
          plan: "TRIAL",
          sitesLimit: TRIAL_SITES_LIMIT,
          priceRub: 300,
          status: "active",
          currentPeriodEnd: trialEnd,
        },
      },
    },
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const trialEndStr = trialEnd.toLocaleDateString("ru-RU");
  await sendMail({
    to: email,
    subject: "Доступ к Logsy — ваш пароль",
    text:
      `Здравствуйте!\n\n` +
      `Вы зарегистрировались в Logsy — сервисе мониторинга доступности сайтов.\n\n` +
      `Вам активирован бесплатный пробный период на ${TRIAL_DAYS} дней ` +
      `(1 сайт) — до ${trialEndStr}.\n\n` +
      `Данные для входа:\n` +
      `  Логин (email): ${email}\n` +
      `  Пароль: ${password}\n\n` +
      `Войти: ${appUrl}/login\n\n` +
      `Рекомендуем сменить пароль после первого входа.\n` +
      `— Команда Logsy`,
  });

  return NextResponse.json({ ok: true });
}
