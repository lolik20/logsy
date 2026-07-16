// Редактирование, перемещение и удаление задачи доски проекта.
//
// PATCH  { title?, description?, status?, position? } — обновить задачу. Смена status
//        и/или position используется при перетаскивании между колонками.
// DELETE — удалить задачу.
//
// Доступ — только владельцу проекта задачи (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { TASK_STATUSES } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(4000).optional().nullable(),
    status: z.enum(TASK_STATUSES).optional(),
    position: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Нет полей для обновления" });

type Denied = { error: string; status: number };

async function accessError(projectUserId: string): Promise<Denied | null> {
  const userId = await getUserId();
  if (!userId) return { error: "Не авторизован", status: 401 };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { error: "Нет доступа", status: 403 };
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  const denied = await accessError(task.project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const data: {
    title?: string;
    description?: string | null;
    status?: string;
    position?: number;
  } = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description || null;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.position !== undefined) data.position = parsed.data.position;

  const updated = await prisma.task.update({ where: { id: task.id }, data });
  return NextResponse.json({ task: updated });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const task = await prisma.task.findUnique({
    where: { id: params.id },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

  const denied = await accessError(task.project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  await prisma.task.delete({ where: { id: task.id } });
  return NextResponse.json({ ok: true });
}
