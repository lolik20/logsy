// Отдаёт записанные rrweb-события сессии для воспроизведения в панели.
//
// В отличие от /api/logger/rec (приём записи с сайта проекта, keyless по Origin), это
// внутренний эндпоинт панели: доступ только владельцу проекта (или админу). Собирает
// чанки записи сессии по порядку, разворачивает их в единый поток событий rrweb и
// сортирует по времени — плеер (rrweb-player) воспроизводит его как видео.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const admin = await isAdmin();

  const session = await prisma.logSession.findUnique({
    where: { id: params.sessionId },
    select: { id: true, project: { select: { userId: true } } },
  });
  if (!session || (session.project.userId !== userId && !admin)) {
    return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  }

  const chunks = await prisma.recordingChunk.findMany({
    where: { sessionId: session.id },
    orderBy: [{ seq: "asc" }, { createdAt: "asc" }],
    select: { data: true },
  });

  // Разворачиваем чанки в единый поток событий rrweb. data — JSON-массив событий.
  const events: Array<{ timestamp?: number }> = [];
  let corrupt = 0;
  for (const c of chunks) {
    try {
      const parsed = JSON.parse(c.data);
      if (Array.isArray(parsed)) events.push(...parsed);
    } catch {
      // Повреждённый чанк пропускаем, чтобы не сломать всю запись.
      corrupt++;
    }
  }

  // Диагностика воспроизведения: видно, дошли ли чанки до БД и сколько событий собралось.
  // Плеер требует минимум 2 события — если чанков нет или их мало, это первый признак,
  // что запись не долетела с сайта (см. логи [logsy/rec] на приёме).
  console.log(
    `[logsy/recordings] сессия ${session.id}: чанков=${chunks.length}, событий=${events.length}` +
      (corrupt ? `, повреждённых чанков пропущено=${corrupt}` : ""),
  );

  // Порядок воспроизведения — строго по времени события (устойчиво к перекрытию чанков,
  // например при отправке из разных вкладок/страниц одной сессии).
  events.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  return NextResponse.json(
    { events },
    { headers: { "Cache-Control": "no-store" } },
  );
}
