// Управление игнор-листом сервиса логирования. Правило-исключение действует на весь
// проект и задаётся парой (тип события + endpoint). Endpoint — путь запроса без
// query-строки. Пока правило активно, новые такие события не сохраняются (фильтр в
// /api/logger/ingest). Уже записанные события остаются как есть.
//
// POST   { eventId } — добавить (тип + endpoint) события в исключения.
// DELETE { eventId } | { id } — снять правило (по событию или по id правила).
//
// Доступ — только владельцу проекта (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { endpointOf } from "@/lib/logging";

export const dynamic = "force-dynamic";

const postSchema = z.object({ eventId: z.string().min(1) });
const deleteSchema = z.union([
  z.object({ eventId: z.string().min(1) }),
  z.object({ id: z.string().min(1) }),
]);

type Denied = { ok: false; error: string; status: number };

/** Проверяет, что текущий пользователь — владелец проекта (или админ). null — доступ есть. */
async function accessError(projectUserId: string): Promise<Denied | null> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Не авторизован", status: 401 };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { ok: false, error: "Нет доступа", status: 403 };
  return null;
}

type EventMatch = { projectId: string; type: string; endpoint: string };

/** Пара (тип + endpoint) события — на весь проект. Требует, чтобы у события был endpoint. */
async function matchForEvent(
  eventId: string,
): Promise<Denied | { ok: true; match: EventMatch }> {
  const event = await prisma.logEvent.findUnique({
    where: { id: eventId },
    select: {
      type: true,
      route: true,
      projectId: true,
      session: { select: { project: { select: { userId: true } } } },
    },
  });
  if (!event) return { ok: false, error: "Событие не найдено", status: 404 };

  const denied = await accessError(event.session.project.userId);
  if (denied) return denied;

  const endpoint = endpointOf(event.route);
  if (!endpoint) {
    return { ok: false, error: "У события нет endpoint — исключить нельзя", status: 400 };
  }

  return { ok: true, match: { projectId: event.projectId, type: event.type, endpoint } };
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const res = await matchForEvent(parsed.data.eventId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  const { match } = res;

  // Идемпотентно: пара (проект, тип, endpoint) уникальна — upsert не создаёт дубликат.
  const exception = await prisma.logException.upsert({
    where: {
      projectId_type_endpoint: {
        projectId: match.projectId,
        type: match.type,
        endpoint: match.endpoint,
      },
    },
    create: match,
    update: {},
  });

  return NextResponse.json({ exception });
}

export async function DELETE(req: Request) {
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  // Снятие по id правила — из блока «Исключения» на странице логов.
  if ("id" in parsed.data) {
    const exception = await prisma.logException.findUnique({
      where: { id: parsed.data.id },
      select: { id: true, project: { select: { userId: true } } },
    });
    if (!exception) return NextResponse.json({ error: "Правило не найдено" }, { status: 404 });

    const denied = await accessError(exception.project.userId);
    if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
    await prisma.logException.delete({ where: { id: exception.id } });
    return NextResponse.json({ ok: true });
  }

  // Снятие по событию — переключатель кнопки напротив события.
  const res = await matchForEvent(parsed.data.eventId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  await prisma.logException.deleteMany({ where: res.match });
  return NextResponse.json({ ok: true });
}
