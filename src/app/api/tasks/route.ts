// Создание задач доски проекта вручную.
//
// POST { projectId, title, description?, status? } — создать задачу. По умолчанию
// статус CREATED. Новая задача кладётся наверх своей колонки. Доступ — только
// владельцу проекта (или администратору).

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { TASK_STATUSES } from "@/lib/tasks";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  projectId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
});

type Denied = { error: string; status: number };

/** Проверяет, что текущий пользователь — владелец проекта (или админ). null — доступ есть. */
async function accessError(projectUserId: string): Promise<Denied | null> {
  const userId = await getUserId();
  if (!userId) return { error: "Не авторизован", status: 401 };
  const admin = await isAdmin();
  if (projectUserId !== userId && !admin) return { error: "Нет доступа", status: 403 };
  return null;
}

export async function POST(req: Request) {
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { projectId, title, description, status } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  });
  if (!project) return NextResponse.json({ error: "Проект не найден" }, { status: 404 });

  const denied = await accessError(project.userId);
  if (denied) return NextResponse.json({ error: denied.error }, { status: denied.status });

  const col = status ?? "CREATED";
  // Кладём задачу наверх колонки — минимальная позиция минус один.
  const top = await prisma.task.aggregate({
    where: { projectId, status: col },
    _min: { position: true },
  });
  const position = (top._min.position ?? 0) - 1;

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      description: description || null,
      status: col,
      source: "MANUAL",
      position,
    },
  });

  return NextResponse.json({ task });
}
