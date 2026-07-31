import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { projectByApiKey } from "@/lib/api-key";
import { ERROR_TYPES } from "@/lib/topIssues";

export const dynamic = "force-dynamic";

// Публичное HTTP-API: список пользовательских сессий проекта.
// Авторизация — ключом проекта (Authorization: Bearer <key> либо X-Api-Key).
// Документация для пользователя — на вкладке «API» проекта в панели.

/** Максимум сессий в одном ответе. */
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/** Типы событий, которые считаем «медленными» (для счётчика в карточке сессии). */
const SLOW_TYPES = ["SLOW_REQUEST", "SLOW_RESOURCE"];

/** Разбирает дату из query: YYYY-MM-DD (начало суток UTC) или ISO-строку. */
function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Целое число из query с ограничением диапазона; при отсутствии/мусоре — fallback. */
function parseInt10(value: string | null, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(req: Request) {
  const project = await projectByApiKey(req);
  if (!project) {
    return NextResponse.json(
      { error: "Неверный или отсутствующий ключ API" },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const limit = parseInt10(url.searchParams.get("limit"), DEFAULT_LIMIT, 1, MAX_LIMIT);
  const offset = parseInt10(url.searchParams.get("offset"), 0, 0, Number.MAX_SAFE_INTEGER);

  // Окно выборки по времени старта сессии. `date` — сахар для «за конкретные сутки
  // UTC», `from`/`to` — произвольный диапазон. Если передан `date`, он задаёт обе
  // границы и перекрывает `from`/`to`.
  const day = parseDate(url.searchParams.get("date"));
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  const gte = day ?? from;
  const lt = day ? new Date(day.getTime() + 24 * 60 * 60 * 1000) : to;

  const where = {
    projectId: project.id,
    ...(gte || lt ? { startedAt: { ...(gte ? { gte } : {}), ...(lt ? { lt } : {}) } } : {}),
  };

  // Сортировка по последней активности убыв. — как и в панели: сверху самые «живые».
  const [total, sessions] = await Promise.all([
    prisma.logSession.count({ where }),
    prisma.logSession.findMany({
      where,
      orderBy: { lastSeenAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        sessionKey: true,
        startedAt: true,
        lastSeenAt: true,
        ip: true,
        country: true,
        userAgent: true,
        utm: true,
        _count: { select: { events: true } },
      },
    }),
  ]);

  // Счётчики ошибок и медленных событий по сессиям текущей страницы — одним запросом.
  const ids = sessions.map((s) => s.id);
  const groups = ids.length
    ? await prisma.logEvent.groupBy({
        by: ["sessionId", "type"],
        where: { sessionId: { in: ids }, type: { in: [...ERROR_TYPES, ...SLOW_TYPES] } },
        _count: { _all: true },
      })
    : [];
  const errors = new Map<string, number>();
  const slow = new Map<string, number>();
  for (const g of groups) {
    const target = SLOW_TYPES.includes(g.type) ? slow : errors;
    target.set(g.sessionId, (target.get(g.sessionId) ?? 0) + g._count._all);
  }

  return NextResponse.json({
    project,
    total,
    limit,
    offset,
    sessions: sessions.map((s) => ({
      id: s.id,
      sessionKey: s.sessionKey,
      startedAt: s.startedAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      ip: s.ip,
      country: s.country,
      userAgent: s.userAgent,
      utm: parseJson(s.utm),
      events: {
        total: s._count.events,
        errors: errors.get(s.id) ?? 0,
        slow: slow.get(s.id) ?? 0,
      },
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
