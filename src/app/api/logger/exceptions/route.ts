// Управление игнор-листом сервиса логирования. Правило-исключение действует на весь
// проект: его сигнатура (тип + сообщение + маршрут) не привязана к сессии.
//
// POST { eventId } — добавить событие в исключения: создать правило и удалить уже
//   записанные совпадающие события во всех сессиях проекта. Будущие такие же события
//   не сохранит фильтр в /api/logger/ingest.
// DELETE { id } — снять правило (по его id): такие события снова будут сохраняться.
//
// Доступ — только владельцу проекта (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({ eventId: z.string().min(1) });
const deleteSchema = z.object({ id: z.string().min(1) });

/** Проверяет, что текущий пользователь — владелец проекта (или админ). */
async function assertProjectAccess(projectUserId: string) {
  const userId = await getUserId();
  if (!userId) return { error: "Не авторизован", status: 401 as const };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { error: "Нет доступа", status: 403 as const };
  return { ok: true as const };
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const event = await prisma.logEvent.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      type: true,
      message: true,
      route: true,
      projectId: true,
      session: { select: { project: { select: { userId: true } } } },
    },
  });
  if (!event) return NextResponse.json({ error: "Событие не найдено" }, { status: 404 });

  const access = await assertProjectAccess(event.session.project.userId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  // Сигнатура правила — на весь проект (тип + сообщение + маршрут), без привязки к сессии.
  const match = {
    projectId: event.projectId,
    type: event.type,
    message: event.message,
    route: event.route,
  };

  // Идемпотентно: если правило уже есть — переиспользуем его, дубликат не создаём.
  const existing = await prisma.logException.findFirst({ where: match });
  const exception = existing ?? (await prisma.logException.create({ data: match }));

  // Исключение действует на весь проект, поэтому убираем и уже записанные совпадающие
  // события во всех сессиях проекта — иначе ошибка осталась бы видна у других посетителей.
  const removed = await prisma.logEvent.deleteMany({ where: match });

  return NextResponse.json({ exception, removed: removed.count });
}

export async function DELETE(req: Request) {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const exception = await prisma.logException.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!exception) return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });

  const access = await assertProjectAccess(exception.project.userId);
  if ("error" in access) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  await prisma.logException.delete({ where: { id: exception.id } });
  return NextResponse.json({ ok: true });
}
