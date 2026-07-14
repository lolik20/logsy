// Управление игнор-листом сервиса логирования. Правило-исключение действует на весь
// проект и описывается двумя условиями: категорией события (медленный запрос / ошибка)
// и условием по URL (содержит / равно). Пользователь задаёт их в модалке «В исключения»,
// куда параметры подставляются из карточки события. Пока правило активно, новые
// подходящие события не сохраняются (фильтр в /api/logger/ingest). Уже записанные
// события остаются как есть.
//
// POST   { projectId, kind, urlMode, url } — создать правило-исключение.
// DELETE { id } — снять правило.
//
// Доступ — только владельцу проекта (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  projectId: z.string().min(1),
  kind: z.enum(["SLOW_REQUEST", "ERROR"]),
  urlMode: z.enum(["CONTAINS", "EQUALS"]),
  url: z.string().trim().min(1).max(2000),
});
const deleteSchema = z.object({ id: z.string().min(1) });

type Denied = { ok: false; error: string; status: number };

/** Проверяет, что текущий пользователь — владелец проекта (или админ). null — доступ есть. */
async function accessError(projectUserId: string): Promise<Denied | null> {
  const userId = await getUserId();
  if (!userId) return { ok: false, error: "Не авторизован", status: 401 };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { ok: false, error: "Нет доступа", status: 403 };
  return null;
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { projectId, kind, urlMode, url } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

  const denied = await accessError(project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  // Идемпотентно: пара (проект, категория, режим, url) уникальна — upsert не плодит дубли.
  const exception = await prisma.logException.upsert({
    where: { projectId_kind_urlMode_url: { projectId, kind, urlMode, url } },
    create: { projectId, kind, urlMode, url },
    update: {},
  });

  return NextResponse.json({ exception });
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

  const denied = await accessError(exception.project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });
  await prisma.logException.delete({ where: { id: exception.id } });
  return NextResponse.json({ ok: true });
}
