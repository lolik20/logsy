// Очистка логов проекта по запросу владельца (или администратора).
// Удаляет все сессии проекта; связанные события удаляются каскадом.
// Суточный счётчик квоты (LogUsage) НЕ трогаем — иначе очисткой можно было бы
// обнулять дневной лимит и обходить квоту тарифа.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

const schema = z.object({ projectId: z.string().min(1) });

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
    select: { id: true, userId: true },
  });
  if (!project || (project.userId !== userId && !admin)) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  const { count } = await prisma.logSession.deleteMany({
    where: { projectId: project.id },
  });

  return NextResponse.json({ ok: true, deletedSessions: count });
}
