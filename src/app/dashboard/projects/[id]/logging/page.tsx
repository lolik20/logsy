import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { LogDateFilter } from "@/components/LogDateFilter";
import { LogErrorFilter } from "@/components/LogErrorFilter";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ProjectExceptions } from "@/components/ProjectExceptions";
import { ClearLogsButton } from "@/components/ClearLogsButton";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { TopIssues } from "@/components/TopIssues";
import { isProjectServiceActive } from "@/lib/subscription";
import { flagEmoji } from "@/lib/geo";
import { ERROR_TYPES as ISSUE_ERROR_TYPES, topErrors, topSlowRequests, type IssueEvent } from "@/lib/topIssues";

export const dynamic = "force-dynamic";

/** Локальная дата в формате YYYY-MM-DD. */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ERROR_TYPES = ISSUE_ERROR_TYPES;

export default async function LoggingPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { date?: string; errors?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const active = isProjectServiceActive(project, admin);

  // День для фильтра: из query или сегодня.
  const dateStr =
    searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : toDateInput(new Date());
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // Автообновление имеет смысл только для сегодняшней (живой) даты.
  const isToday = dateStr === toDateInput(new Date());

  const sessions = await prisma.logSession.findMany({
    where: { projectId: project.id, startedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { startedAt: "desc" },
    take: 200,
    include: { _count: { select: { events: true } } },
  });

  // Число «ошибочных» и «медленных» событий на каждую сессию — для индикаторов в карточке.
  const ids = sessions.map((s) => s.id);
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

  // Топы ошибок и медленных запросов за день: берём события-ошибки и медленные запросы
  // сессий и сворачиваем их (см. topErrors / topSlowRequests в src/lib/topIssues.ts).
  // Сортировка по времени убыв. — чтобы для перехода бралась самая свежая сессия.
  const issueEvents: IssueEvent[] = ids.length
    ? await prisma.logEvent.findMany({
        where: { sessionId: { in: ids }, type: { in: [...ERROR_TYPES, "SLOW_REQUEST"] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sessionId: true,
          type: true,
          message: true,
          route: true,
          method: true,
          statusCode: true,
          durationMs: true,
          url: true,
          createdAt: true,
        },
      })
    : [];
  const errorsTop = topErrors(issueEvents);
  const slowTop = topSlowRequests(issueEvents);

  // Группируем сессии по IP пользователя. Сессии уже отсортированы по времени убыв.,
  // поэтому группы идут в порядке появления самой свежей сессии.
  type Sess = (typeof sessions)[number];
  const ipGroupsMap = new Map<string, Sess[]>();
  for (const s of sessions) {
    const key = s.ip || "Без IP";
    const arr = ipGroupsMap.get(key);
    if (arr) arr.push(s);
    else ipGroupsMap.set(key, [s]);
  }
  const allIpGroups = Array.from(ipGroupsMap.entries()).map(([ip, list]) => ({
    ip,
    list,
    // Сессии отсортированы по времени убыв. — берём начало самой свежей сессии IP.
    startedAt: list[0].startedAt,
    // Страна пользователя по IP: берём первый определённый код среди сессий группы.
    country: list.find((s) => s.country)?.country ?? null,
    errors: list.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0),
    slow: list.reduce((n, s) => n + (slowCount.get(s.id) ?? 0), 0),
    reports: list.reduce((n, s) => n + (reportCount.get(s.id) ?? 0), 0),
  }));

  // Фильтр «с ошибками»: при ?errors=1 показываем только группы, где были ошибки.
  const onlyErrors = searchParams?.errors === "1";
  const ipGroups = onlyErrors ? allIpGroups.filter((g) => g.errors > 0) : allIpGroups;

  // Активные правила-исключения проекта (игнор-лист) — блок управления над списком сессий.
  const exceptions = await prisma.logException.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, kind: true, urlMode: true, url: true },
  });

  return (
    <div>
      {isToday && active && <AutoRefresh />}
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="logging"
      />

      {!active && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          Тариф проекта не активен — приём логов остановлен. Продлите тариф во
          вкладке «Тариф».
        </div>
      )}

      <ProjectExceptions exceptions={exceptions} />

      <TopIssues errors={errorsTop} slow={slowTop} projectId={project.id} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          Сессии пользователей
          <span className="ml-2 text-slate-400">{ipGroups.length}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <LogErrorFilter />
          <LogDateFilter value={dateStr} />
          <ClearLogsButton projectId={project.id} />
        </div>
      </div>

      {ipGroups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          {onlyErrors
            ? "За выбранную дату сессий с ошибками нет."
            : "За выбранную дату сессий нет."}
        </p>
      ) : (
        <div className="space-y-2">
          {ipGroups.map((g) => (
            <Link
              key={g.ip}
              href={`/dashboard/projects/${project.id}/logging/combined?ip=${encodeURIComponent(g.ip)}&date=${dateStr}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-500">
                  {new Date(g.startedAt).toLocaleTimeString("ru-RU")}
                </span>
                {g.country && (
                  <span
                    className="text-base leading-none"
                    title={g.country}
                    aria-label={g.country}
                  >
                    {flagEmoji(g.country)}
                  </span>
                )}
                <span className="text-xs uppercase tracking-wide text-slate-400">IP</span>
                <span className="font-mono text-sm font-semibold">{g.ip}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold">
                {g.reports > 0 && (
                  <span
                    className="flex items-center gap-1 text-violet-600"
                    title="Сообщения пользователя"
                  >
                    <EventTypeIcon type="USER_REPORT" />
                    {g.reports}
                  </span>
                )}
                {g.errors > 0 && (
                  <span className="flex items-center gap-1.5 text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    {g.errors}
                  </span>
                )}
                {g.slow > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-500">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {g.slow}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
