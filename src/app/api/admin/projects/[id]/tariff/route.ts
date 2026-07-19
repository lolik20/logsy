import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

// Управление тарифом конкретного проекта администратором. Биллинг в сервисе
// привязан к проекту (Project.billingStatus / currentPeriodEnd гейтят работу
// мониторинга и логирования), поэтому админ выдаёт активный тариф с датой
// окончания («до …») именно проекту либо снимает его (возврат на бесплатный).

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

/** Выдать проекту активный тариф до указанной даты. */
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

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  // Активируем тариф проекта до указанной даты. Кастомную конфигурацию (лимиты
  // сессий и хранения) не трогаем — продлеваем как есть. Сбрасываем
  // expiryAlertSentFor, чтобы напоминание сработало для нового срока.
  await prisma.project.update({
    where: { id: project.id },
    data: {
      billingStatus: "ACTIVE",
      currentPeriodEnd: periodEnd,
      expiryAlertSentFor: null,
    },
  });

  return NextResponse.json({ ok: true, until: periodEnd.toISOString() });
}

/** Снять тариф — вернуть проект на бесплатный. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      billingStatus: "FREE",
      currentPeriodEnd: null,
      expiryAlertSentFor: null,
    },
  });

  return NextResponse.json({ ok: true });
}
