import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { projectByApiKey } from "@/lib/api-key";
import { ERROR_TYPES } from "@/lib/topIssues";

export const dynamic = "force-dynamic";

// Публичное HTTP-API: подробная информация по одной сессии — все её события в JSON.
// Авторизация — ключом проекта (Authorization: Bearer <key> либо X-Api-Key).

const SLOW_TYPES = ["SLOW_REQUEST", "SLOW_RESOURCE"];

export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
) {
  const project = await projectByApiKey(req);
  if (!project) {
    return NextResponse.json(
      { error: "Неверный или отсутствующий ключ API" },
      { status: 401 },
    );
  }

  // Сессию ищем и по внутреннему id (его отдаёт список), и по sessionKey — ключу,
  // который SDK генерирует на клиенте: так интеграции могут запросить сессию по
  // идентификатору, который у них уже есть на сайте.
  const select = {
    id: true,
    sessionKey: true,
    startedAt: true,
    lastSeenAt: true,
    ip: true,
    country: true,
    userAgent: true,
    utm: true,
    projectId: true,
  };
  const byId = await prisma.logSession.findUnique({
    where: { id: params.sessionId },
    select,
  });
  const session =
    byId && byId.projectId === project.id
      ? byId
      : await prisma.logSession.findUnique({
          where: {
            projectId_sessionKey: {
              projectId: project.id,
              sessionKey: params.sessionId,
            },
          },
          select,
        });

  if (!session) {
    return NextResponse.json({ error: "Сессия не найдена" }, { status: 404 });
  }

  const events = await prisma.logEvent.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      message: true,
      stack: true,
      url: true,
      route: true,
      query: true,
      method: true,
      statusCode: true,
      durationMs: true,
      reqBody: true,
      resBody: true,
      meta: true,
      createdAt: true,
    },
  });

  // Есть ли для сессии запись экрана (rrweb) — сами чанки через API не отдаём,
  // это большой бинароподобный объём; отдаём только признак и их количество.
  const recordingChunks = await prisma.recordingChunk.count({
    where: { sessionId: session.id },
  });

  return NextResponse.json({
    project,
    session: {
      id: session.id,
      sessionKey: session.sessionKey,
      startedAt: session.startedAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      ip: session.ip,
      country: session.country,
      userAgent: session.userAgent,
      utm: parseJson(session.utm),
      events: {
        total: events.length,
        errors: events.filter((e) => (ERROR_TYPES as readonly string[]).includes(e.type)).length,
        slow: events.filter((e) => SLOW_TYPES.includes(e.type)).length,
      },
      recording: { available: recordingChunks > 0, chunks: recordingChunks },
    },
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      createdAt: e.createdAt.toISOString(),
      message: e.message,
      stack: e.stack,
      url: e.url,
      route: e.route,
      query: e.query,
      method: e.method,
      statusCode: e.statusCode,
      durationMs: e.durationMs,
      reqBody: e.reqBody,
      resBody: e.resBody,
      meta: parseJson(e.meta),
    })),
  });
}

/** Безопасно разбирает JSON-строку из БД; при сбое возвращает null. */
function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
