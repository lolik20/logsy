// Управление игнор-листом сервиса логирования. Пользователь из карточки события
// добавляет его сигнатуру (тип + сообщение + маршрут) в исключения — и будущие
// такие же события не сохраняются (фильтрация в /api/logger/ingest). DELETE снимает
// правило. Доступ — только владельцу проекта (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const schema = z.object({ eventId: z.string().min(1) });

/** Находит событие и проверяет, что текущий пользователь имеет к нему доступ. */
async function loadEvent(eventId: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Не авторизован", status: 401 as const };

  const event = await prisma.logEvent.findUnique({
    where: { id: eventId },
    select: {
      type: true,
      message: true,
      route: true,
      projectId: true,
      session: { select: { project: { select: { userId: true } } } },
    },
  });
  if (!event) return { error: "Событие не найдено", status: 404 as const };

  const admin = await isAdmin();
  if (event.session.project.userId !== userId && !admin) {
    return { error: "Нет доступа", status: 403 as const };
  }
  return { event };
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const res = await loadEvent(parsed.data.eventId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const { event } = res;

  // Идемпотентно: если правило уже есть — возвращаем его, дубликат не создаём.
  const existing = await prisma.logException.findFirst({
    where: {
      projectId: event.projectId,
      type: event.type,
      message: event.message,
      route: event.route,
    },
  });
  const exception =
    existing ??
    (await prisma.logException.create({
      data: {
        projectId: event.projectId,
        type: event.type,
        message: event.message,
        route: event.route,
      },
    }));

  return NextResponse.json({ exception });
}

export async function DELETE(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const res = await loadEvent(parsed.data.eventId);
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: res.status });
  const { event } = res;

  await prisma.logException.deleteMany({
    where: {
      projectId: event.projectId,
      type: event.type,
      message: event.message,
      route: event.route,
    },
  });

  return NextResponse.json({ ok: true });
}
