import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import {
  isSubscriptionActive,
  isServiceActive,
  resolveSitesLimit,
} from "@/lib/subscription";

const schema = z.object({
  name: z.string().min(1, "Укажите название").max(120),
  domain: z.string().min(1, "Укажите домен").max(255),
});

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

  const admin = await isAdmin();
  const sub = await prisma.subscription.findUnique({ where: { userId } });

  // Пробный период истёк или подписка не оплачена — новые сайты недоступны.
  // Администратор не ограничен подпиской.
  if (!isServiceActive(sub, admin)) {
    return NextResponse.json(
      {
        error:
          "Бесплатный период закончился или подписка не активна. " +
          "Оформите подписку в разделе «Тарифы», чтобы продолжить.",
      },
      { status: 402 },
    );
  }

  // Проверка лимита тарифа: количество сайтов не больше sitesLimit.
  // Для администратора лимит безлимитный (Infinity), поэтому проверка не сработает.
  const limit = resolveSitesLimit(sub, admin);
  const count = await prisma.project.count({ where: { userId } });
  if (count >= limit) {
    return NextResponse.json(
      {
        error: `Достигнут лимит тарифа (${limit} сайт(ов)). Оформите подписку в разделе «Тарифы».`,
      },
      { status: 402 },
    );
  }

  const domain = parsed.data.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Антифрод по домену: если такой сайт уже мониторит другой аккаунт, добавить
  // его можно только на платном тарифе (после оплаты). Так один и тот же домен
  // нельзя бесплатно «размножать» по разным аккаунтам с пробным периодом.
  // Администратору доступен любой домен без ограничений антифрода.
  const paid = admin || (sub?.plan === "PAID" && isSubscriptionActive(sub));
  if (!paid) {
    const takenByOther = await prisma.project.findFirst({
      where: {
        domain: { equals: domain, mode: "insensitive" },
        userId: { not: userId },
      },
      select: { id: true },
    });
    if (takenByOther) {
      return NextResponse.json(
        {
          error:
            "Этот домен уже отслеживается на другом аккаунте. Добавить его " +
            "можно только на платном тарифе — оформите подписку в разделе «Тарифы».",
        },
        { status: 402 },
      );
    }
  }

  const project = await prisma.project.create({
    data: { userId, name: parsed.data.name.trim(), domain },
  });

  return NextResponse.json({ project });
}
