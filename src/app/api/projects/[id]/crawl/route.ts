// Запуск краулера карты страниц проекта по запросу владельца (или администратора).
// Бот обходит домен проекта по внутренним ссылкам и наполняет ProjectPage. Обход
// синхронный и ограничен по времени/числу страниц (см. src/lib/crawler.ts).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { crawlProject } from "@/lib/crawler";

export const dynamic = "force-dynamic";
// Обход может занять до ~25с — поднимаем лимит выполнения обработчика.
export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!project || (project.userId !== userId && !admin)) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  try {
    const result = await crawlProject(project.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Logsy] Ошибка обхода карты страниц:", err);
    return NextResponse.json({ error: "Не удалось обойти сайт" }, { status: 500 });
  }
}
