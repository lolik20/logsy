import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { FREE_SITES_LIMIT } from "@/lib/subscription";

// Управление тарифом пользователя администратором (вкладка «Пользователи»).
// Админ может выдать пользователю активный (платный) тариф с датой окончания
// («до …») либо снять его и вернуть на бесплатный.
//
// Так как биллинг в сервисе привязан к проекту (Project.billingStatus /
// currentPeriodEnd — именно они гейтят мониторинг/логирование), выданный тариф
// применяется и к записи подписки пользователя (для отображения в списке), и ко
// всем его проектам — чтобы сервис действительно работал до указанной даты.

const grantSchema = z.object({
  // Дата, до которой действует тариф (включительно). ISO-строка (YYYY-MM-DD или
  // полный ISO). Тариф считается активным до конца указанного дня.
  until: z.coerce.date(),
});

/** Приводит дату к концу дня (23:59:59.999) — тариф действует весь указанный день. */
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Выдать пользователю активный тариф до указанной даты. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const parsed = grantSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const periodEnd = endOfDay(parsed.data.until);
  if (periodEnd.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Дата окончания должна быть в будущем" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  // Запись подписки пользователя (для отображения статуса в списке).
  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "PAID",
      status: "active",
      currentPeriodEnd: periodEnd,
      // expiryAlertSentFor не задаём — напоминание сработает для нового срока.
    },
    update: {
      plan: "PAID",
      status: "active",
      currentPeriodEnd: periodEnd,
      expiryAlertSentFor: null,
    },
  });

  // Активируем тариф всем проектам пользователя до этой же даты — именно проектный
  // биллинг определяет работу мониторинга/логирования. Кастомную конфигурацию
  // проектов (лимиты сессий и хранения) не трогаем — продлеваем как есть.
  await prisma.project.updateMany({
    where: { userId: user.id },
    data: {
      billingStatus: "ACTIVE",
      currentPeriodEnd: periodEnd,
      expiryAlertSentFor: null,
    },
  });

  return NextResponse.json({ ok: true, until: periodEnd.toISOString() });
}

/** Снять тариф — вернуть пользователя и его проекты на бесплатный. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  await prisma.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      plan: "FREE",
      sitesLimit: FREE_SITES_LIMIT,
      priceRub: 0,
      status: "active",
    },
    update: {
      plan: "FREE",
      status: "active",
      currentPeriodEnd: null,
      expiryAlertSentFor: null,
    },
  });

  await prisma.project.updateMany({
    where: { userId: user.id },
    data: {
      billingStatus: "FREE",
      currentPeriodEnd: null,
      expiryAlertSentFor: null,
    },
  });

  return NextResponse.json({ ok: true });
}
