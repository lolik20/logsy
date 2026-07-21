// Отдаёт записанные rrweb-события сессии для воспроизведения в панели.
//
// В отличие от /api/logger/rec (приём записи с сайта проекта, keyless по Origin), это
// внутренний эндпоинт панели: доступ только владельцу проекта (или админу). Собирает
// чанки записи сессии по порядку, разворачивает их в единый поток событий rrweb и
// сортирует по времени — плеер панели воспроизводит его как видео.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { DEMO_SESSION_ID, buildDemoRecording } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { sessionId: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  const admin = await isAdmin();

  // Тестовая (demo) сессия — синтетическая запись «страницы оплаты» demo-магазина. В БД её нет,
  // поэтому отдаём сгенерированный поток событий rrweb с метками ошибки и медленного запроса.
  // Доступно любому залогиненному пользователю (demo-сайт показывается тем, кто ещё не подключил
  // свой сайт). База отсчёта — «недавно», чтобы запись выглядела свежей.
  if (params.sessionId === DEMO_SESSION_ID) {
    const { events, markers } = buildDemoRecording(Date.now() - 12_000);
    return NextResponse.json({ events, markers }, { headers: { "Cache-Control": "no-store" } });
  }

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

  // Метки для таймлайна плеера: ошибки и медленные запросы этой сессии. Плеер панели
  // рисует их как цветные рисочки на дорожке времени. Время события (createdAt) выставляется
  // из клиентского ts при приёме (см. /api/logger/ingest), т.е. идёт по тем же часам, что и
  // timestamp событий rrweb, — поэтому метки встают на запись точно по времени.
  const MARKER_TYPES = ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR", "SLOW_REQUEST"];
  const markerEvents = await prisma.logEvent.findMany({
    where: { sessionId: session.id, type: { in: MARKER_TYPES } },
    orderBy: { createdAt: "asc" },
    // Полная информация о событии — чтобы плеер показал её в подсказке и дал скопировать.
    select: {
      type: true,
      message: true,
      route: true,
      query: true,
      method: true,
      statusCode: true,
      durationMs: true,
      url: true,
      reqBody: true,
      resBody: true,
      stack: true,
      createdAt: true,
    },
  });
  const markers = markerEvents.map((e) => ({
    t: e.createdAt.getTime(),
    kind: e.type === "SLOW_REQUEST" ? ("slow" as const) : ("error" as const),
    // Короткая подпись (тип + адрес) для строки заголовка подсказки.
    label: [e.message, e.route].filter(Boolean).join(" · ").slice(0, 120),
    type: e.type,
    message: e.message,
    method: e.method,
    route: e.route,
    query: e.query,
    statusCode: e.statusCode,
    durationMs: e.durationMs,
    url: e.url,
    reqBody: e.reqBody,
    resBody: e.resBody,
    stack: e.stack,
  }));

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
    { events, markers },
    { headers: { "Cache-Control": "no-store" } },
  );
}
