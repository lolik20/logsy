import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { formatSessionLength } from "@/lib/logging";
import { pageUrlToPath } from "@/lib/pages";
import { flagEmoji } from "@/lib/geo";
import { ERROR_TYPES } from "@/lib/topIssues";
import {
  VISITOR_PERIODS,
  VISITOR_SESSION_LIMIT,
  parseVisitorDays,
  toDateInput,
  visitorIpWhere,
  visitorPeriodStart,
} from "@/lib/visitors";

export const dynamic = "force-dynamic";

/**
 * Карточка пользователя: все его сессии за период, сгруппированные по дням.
 * Пользователь определяется по IP (см. src/lib/visitors.ts) — отдельной таблицы нет,
 * это та же LogSession, только свёрнутая иначе, чем на вкладке «Сессии».
 */
export default async function VisitorSessionsPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ip?: string; days?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const ip = (searchParams?.ip ?? "").trim();
  if (!ip) notFound();

  const days = parseVisitorDays(searchParams?.days);
  const since = visitorPeriodStart(days);

  const sessions = await prisma.logSession.findMany({
    where: {
      projectId: project.id,
      lastSeenAt: { gte: since },
      ...visitorIpWhere(ip),
    },
    orderBy: { startedAt: "desc" },
    take: VISITOR_SESSION_LIMIT,
    select: {
      id: true,
      sessionKey: true,
      userAgent: true,
      country: true,
      startedAt: true,
      lastSeenAt: true,
      _count: { select: { events: true } },
    },
  });

  if (sessions.length === 0) notFound();

  const ids = sessions.map((s) => s.id);

  const typeGroups = await prisma.logEvent.groupBy({
    by: ["sessionId", "type"],
    where: {
      sessionId: { in: ids },
      type: { in: [...ERROR_TYPES, "SLOW_REQUEST", "USER_REPORT"] },
    },
    _count: { _all: true },
  });
  const errorCount = new Map<string, number>();
  const slowCount = new Map<string, number>();
  const reportCount = new Map<string, number>();
  for (const g of typeGroups) {
    const target =
      g.type === "SLOW_REQUEST"
        ? slowCount
        : g.type === "USER_REPORT"
          ? reportCount
          : errorCount;
    target.set(g.sessionId, (target.get(g.sessionId) ?? 0) + g._count._all);
  }

  // Страница входа каждой сессии — первое событие с адресом.
  const firstEvents = await prisma.logEvent.findMany({
    where: { sessionId: { in: ids }, url: { not: null } },
    orderBy: { createdAt: "asc" },
    distinct: ["sessionId"],
    select: { sessionId: true, url: true },
  });
  const entryBySession = new Map(
    firstEvents.map((e) => [e.sessionId, pageUrlToPath(e.url)]),
  );

  // У каких сессий есть запись экрана — чтобы вести сразу в плеер.
  const recCounts = await prisma.recordingChunk.groupBy({
    by: ["sessionId"],
    where: { sessionId: { in: ids } },
    _count: { _all: true },
  });
  const recorded = new Set(
    recCounts.filter((r) => r._count._all > 0).map((r) => r.sessionId),
  );

  const totalEvents = sessions.reduce((n, s) => n + s._count.events, 0);
  const totalErrors = sessions.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0);
  const timeOnSiteMs = sessions.reduce(
    (ms, s) => ms + (s.lastSeenAt.getTime() - s.startedAt.getTime()),
    0,
  );
  const firstSeen = sessions[sessions.length - 1].startedAt;
  const lastSeen = sessions.reduce(
    (max, s) => (s.lastSeenAt > max ? s.lastSeenAt : max),
    sessions[0].lastSeenAt,
  );
  const country = sessions.find((s) => s.country)?.country ?? null;
  const uaSet = new Set(sessions.map((s) => s.userAgent ?? ""));
  const commonUa = uaSet.size === 1 ? sessions[0].userAgent : null;

  // Дни визитов: сессии уже отсортированы по началу убыв., поэтому дни идут от
  // свежих к старым, а внутри дня — тот же порядок.
  type Sess = (typeof sessions)[number];
  const byDay = new Map<string, Sess[]>();
  for (const s of sessions) {
    const key = toDateInput(s.startedAt);
    const arr = byDay.get(key);
    if (arr) arr.push(s);
    else byDay.set(key, [s]);
  }

  return (
    <div>
      <Link
        href={`/dashboard/projects/${project.id}/users?days=${days}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К пользователям сайта «{project.name}»
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold">
        {country && (
          <span className="text-xl leading-none" title={country} aria-label={country}>
            {flagEmoji(country)}
          </span>
        )}
        <span className="font-mono">{ip}</span>
      </h1>
      <p className="text-sm text-slate-500">
        Первый визит {new Date(firstSeen).toLocaleString("ru-RU")} · последняя
        активность {new Date(lastSeen).toLocaleString("ru-RU")}
      </p>

      <div className="mt-4 flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 sm:w-fit">
        {VISITOR_PERIODS.map((p) => (
          <Link
            key={p.days}
            href={`/dashboard/projects/${project.id}/users/sessions?ip=${encodeURIComponent(ip)}&days=${p.days}`}
            className={`px-3 py-1.5 text-sm transition-colors ${
              p.days === days
                ? "bg-brand-50 font-medium text-brand dark:bg-brand/15"
                : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Сессий" value={String(sessions.length)} />
        <Stat label="Событий" value={totalEvents.toLocaleString("ru-RU")} />
        <Stat label="Ошибок" value={String(totalErrors)} />
        <Stat label="Времени на сайте" value={formatSessionLength(timeOnSiteMs)} />
      </div>

      {commonUa && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold">User-Agent:</span> {commonUa}
        </div>
      )}

      {Array.from(byDay.entries()).map(([date, list]) => (
        <div key={date} className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              {new Date(`${date}T00:00:00`).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              <span className="ml-2 text-slate-400">{list.length}</span>
            </h2>
            <Link
              href={`/dashboard/projects/${project.id}/logging/combined?ip=${encodeURIComponent(ip)}&date=${date}`}
              className="text-sm text-brand hover:underline"
            >
              Все события дня →
            </Link>
          </div>

          <div className="space-y-2">
            {list.map((s) => {
              const errors = errorCount.get(s.id) ?? 0;
              const slow = slowCount.get(s.id) ?? 0;
              const reports = reportCount.get(s.id) ?? 0;
              const entry = entryBySession.get(s.id);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                >
                  <Link
                    href={`/dashboard/projects/${project.id}/logging/${s.id}`}
                    className="flex min-w-0 flex-1 items-center gap-2 hover:text-brand sm:gap-3"
                  >
                    <span className="shrink-0 text-sm text-slate-500">
                      {new Date(s.startedAt).toLocaleTimeString("ru-RU")}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-400">
                      {s.sessionKey.slice(0, 6)}
                    </span>
                    <span
                      className="shrink-0 text-xs text-slate-500"
                      title="Длительность визита"
                    >
                      {formatSessionLength(
                        s.lastSeenAt.getTime() - s.startedAt.getTime(),
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {s._count.events} соб.
                    </span>
                    {entry && (
                      <span
                        className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 sm:max-w-[220px] sm:flex-none"
                        title={`Страница входа: ${entry}`}
                      >
                        {entry}
                      </span>
                    )}
                  </Link>
                  <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
                    {reports > 0 && (
                      <span
                        className="flex items-center gap-1 text-violet-600"
                        title="Сообщения пользователя"
                      >
                        <EventTypeIcon type="USER_REPORT" />
                        {reports}
                      </span>
                    )}
                    {errors > 0 && (
                      <span className="flex items-center gap-1.5 text-red-600" title="Ошибки">
                        <span className="h-2 w-2 rounded-full bg-red-600" />
                        {errors}
                      </span>
                    )}
                    {slow > 0 && (
                      <span
                        className="flex items-center gap-1.5 text-amber-500"
                        title="Медленные запросы"
                      >
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        {slow}
                      </span>
                    )}
                    {recorded.has(s.id) && (
                      <Link
                        href={`/dashboard/projects/${project.id}/logging/${s.id}/replay`}
                        className="flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Запись
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold">{value}</div>
    </div>
  );
}
