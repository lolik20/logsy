import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { formatSessionLength } from "@/lib/logging";
import { pageUrlToPath } from "@/lib/pages";
import { flagEmoji } from "@/lib/geo";
import { ERROR_TYPES } from "@/lib/topIssues";
import {
  NO_IP,
  VISITOR_PERIODS,
  VISITOR_SESSION_LIMIT,
  parseVisitorDays,
  visitorPeriodStart,
} from "@/lib/visitors";

export const dynamic = "force-dynamic";

/** Окно «активности»: пользователь считается на сайте, если события были за это время. */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

/**
 * Пользователи сайта. Отдельной сущности «пользователь» в базе нет — посетителем
 * считаем IP, а его визиты — это сессии (LogSession) с этим IP за выбранный период.
 * Страница показывает свёрнутые по IP группы, а внутри (users/sessions) — все сессии.
 */
export default async function ProjectUsersPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { days?: string; errors?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const days = parseVisitorDays(searchParams?.days);
  const since = visitorPeriodStart(days);
  const onlineSince = new Date(Date.now() - ONLINE_WINDOW_MS);

  // Берём сессии периода по последней активности убыв. — так группы IP идут в
  // порядке «кто был на сайте недавнее».
  const sessions = await prisma.logSession.findMany({
    where: { projectId: project.id, lastSeenAt: { gte: since } },
    orderBy: { lastSeenAt: "desc" },
    take: VISITOR_SESSION_LIMIT,
    select: {
      id: true,
      ip: true,
      country: true,
      startedAt: true,
      lastSeenAt: true,
      _count: { select: { events: true } },
    },
  });
  const truncated = sessions.length === VISITOR_SESSION_LIMIT;

  const ids = sessions.map((s) => s.id);

  // Ошибки / медленные запросы / сообщения пользователей по каждой сессии —
  // суммируем их внутри группы IP, чтобы показать «проблемность» посетителя.
  const typeGroups = ids.length
    ? await prisma.logEvent.groupBy({
        by: ["sessionId", "type"],
        where: {
          sessionId: { in: ids },
          type: { in: [...ERROR_TYPES, "SLOW_REQUEST", "USER_REPORT"] },
        },
        _count: { _all: true },
      })
    : [];
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

  // Первое событие каждой сессии (distinct по sessionId при сортировке по времени
  // возр.) — из них берём страницу входа самого раннего визита пользователя.
  const firstEvents = ids.length
    ? await prisma.logEvent.findMany({
        where: { sessionId: { in: ids }, url: { not: null } },
        orderBy: { createdAt: "asc" },
        distinct: ["sessionId"],
        select: { sessionId: true, url: true, createdAt: true },
      })
    : [];
  const firstEventBySession = new Map(
    firstEvents.map((e) => [e.sessionId, { url: e.url, createdAt: e.createdAt }]),
  );

  // Группировка сессий по IP. Порядок ключей Map — порядок первого появления,
  // то есть по последней активности убыв.
  type Sess = (typeof sessions)[number];
  const groups = new Map<string, Sess[]>();
  for (const s of sessions) {
    const key = s.ip || NO_IP;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }

  const allVisitors = Array.from(groups.entries()).map(([ip, list]) => {
    let entryUrl: string | null = null;
    let entryAt = Infinity;
    for (const s of list) {
      const fe = firstEventBySession.get(s.id);
      if (fe && fe.createdAt.getTime() < entryAt) {
        entryAt = fe.createdAt.getTime();
        entryUrl = fe.url;
      }
    }
    const firstSeen = list.reduce(
      (min, s) => (s.startedAt < min ? s.startedAt : min),
      list[0].startedAt,
    );
    // Список отсортирован по последней активности убыв. — первая сессия самая свежая.
    const lastSeen = list[0].lastSeenAt;
    return {
      ip,
      sessions: list.length,
      firstSeen,
      lastSeen,
      // Время на сайте — сумма длительностей визитов, а не разрыв между первым
      // и последним: между сессиями пользователь на сайте отсутствует.
      timeOnSiteMs: list.reduce(
        (ms, s) => ms + (s.lastSeenAt.getTime() - s.startedAt.getTime()),
        0,
      ),
      events: list.reduce((n, s) => n + s._count.events, 0),
      country: list.find((s) => s.country)?.country ?? null,
      entryPath: pageUrlToPath(entryUrl),
      online: lastSeen >= onlineSince,
      errors: list.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0),
      slow: list.reduce((n, s) => n + (slowCount.get(s.id) ?? 0), 0),
      reports: list.reduce((n, s) => n + (reportCount.get(s.id) ?? 0), 0),
    };
  });

  const onlyErrors = searchParams?.errors === "1";
  const visitors = onlyErrors ? allVisitors.filter((v) => v.errors > 0) : allVisitors;
  const onlineNow = allVisitors.filter((v) => v.online).length;
  const returning = allVisitors.filter((v) => v.sessions > 1).length;

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="users"
      />

      <div className="mb-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Пользователей" value={allVisitors.length.toLocaleString("ru-RU")} />
        <Stat label="Сессий" value={sessions.length.toLocaleString("ru-RU")} />
        <Stat label="Вернулись" value={returning.toLocaleString("ru-RU")} />
        <Stat label="Сейчас на сайте" value={onlineNow.toLocaleString("ru-RU")} />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Пользователи
          <span className="ml-2 text-slate-400">{visitors.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/dashboard/projects/${project.id}/users?days=${days}${onlyErrors ? "" : "&errors=1"}`}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              onlyErrors
                ? "border-red-300 bg-red-50 font-medium text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
                : "border-slate-200 text-slate-500 hover:text-slate-900 dark:border-slate-800 dark:hover:text-white"
            }`}
          >
            С ошибками
          </Link>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
            {VISITOR_PERIODS.map((p) => (
              <Link
                key={p.days}
                href={`/dashboard/projects/${project.id}/users?days=${p.days}${onlyErrors ? "&errors=1" : ""}`}
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
        </div>
      </div>

      {truncated && (
        <p className="mb-3 text-xs text-slate-400">
          Показаны последние {VISITOR_SESSION_LIMIT.toLocaleString("ru-RU")} сессий
          периода — более давние визиты в группировку не попали.
        </p>
      )}

      {visitors.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {onlyErrors
            ? "За выбранный период пользователей с ошибками нет."
            : "За выбранный период пользователей нет."}
        </p>
      ) : (
        <div className="space-y-2">
          {visitors.map((v) => (
            <Link
              key={v.ip}
              href={`/dashboard/projects/${project.id}/users/sessions?ip=${encodeURIComponent(v.ip)}&days=${days}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                {v.online ? (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                    title="Сейчас на сайте"
                  />
                ) : (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
                )}
                {v.country && (
                  <span
                    className="shrink-0 text-base leading-none"
                    title={v.country}
                    aria-label={v.country}
                  >
                    {flagEmoji(v.country)}
                  </span>
                )}
                <span className="shrink-0 font-mono text-sm font-semibold">{v.ip}</span>
                <span
                  className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  title="Сессий за период"
                >
                  {v.sessions} сес.
                </span>
                <span
                  className="shrink-0 text-xs text-slate-500"
                  title="Суммарное время на сайте"
                >
                  {formatSessionLength(v.timeOnSiteMs)}
                </span>
                {v.entryPath && (
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 sm:max-w-[220px] sm:flex-none"
                    title={`Первая страница входа: ${v.entryPath}`}
                  >
                    {v.entryPath}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
                {v.reports > 0 && (
                  <span
                    className="flex items-center gap-1 text-violet-600"
                    title="Сообщения пользователя"
                  >
                    <EventTypeIcon type="USER_REPORT" />
                    {v.reports}
                  </span>
                )}
                {v.errors > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600" title="Ошибки">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    {v.errors}
                  </span>
                )}
                {v.slow > 0 && (
                  <span
                    className="flex items-center gap-1.5 text-amber-500"
                    title="Медленные запросы"
                  >
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {v.slow}
                  </span>
                )}
                <span className="text-xs font-normal text-slate-400">
                  {new Date(v.lastSeen).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
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
