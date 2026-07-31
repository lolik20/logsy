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
import { SdkStatusCard } from "@/components/SdkStatusCard";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { TopIssues } from "@/components/TopIssues";
import { isProjectServiceActive } from "@/lib/subscription";
import { getSessionUsage, formatSessionLength } from "@/lib/logging";
import { pageUrlToPath } from "@/lib/pages";
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

/** Окно «активности»: сессия считается активной, если события были за это время. */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

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

  // Использование суточной квоты сессий — для красной плашки при превышении лимита.
  const usage = await getSessionUsage(project.id, project);

  // День для фильтра: из query или сегодня.
  const dateStr =
    searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : toDateInput(new Date());
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  // Автообновление имеет смысл только для сегодняшней (живой) даты.
  const isToday = dateStr === toDateInput(new Date());

  // Сортируем по последней активности (lastSeenAt), а не по времени старта сессии —
  // сверху оказываются самые «живые» пользователи, у которых недавно были события.
  // Фильтр по дню оставляем по startedAt: показываем сессии, начавшиеся в выбранный день.
  const sessions = await prisma.logSession.findMany({
    where: { projectId: project.id, startedAt: { gte: dayStart, lt: dayEnd } },
    orderBy: { lastSeenAt: "desc" },
    take: 200,
    include: { _count: { select: { events: true } } },
  });

  // Активные («живые») сессии — те, где активность была за последние ACTIVE_WINDOW_MS.
  // Считаем отдельным запросом по lastSeenAt, без ограничения take и дня старта:
  // сессия, начавшаяся вчера поздно вечером, тоже активна сейчас.
  // Для прошлых дат «сейчас на сайте» смысла не имеет, поэтому только для сегодня.
  const activeSessions = isToday
    ? await prisma.logSession.count({
        where: {
          projectId: project.id,
          lastSeenAt: { gte: new Date(Date.now() - ACTIVE_WINDOW_MS) },
        },
      })
    : 0;

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
          reqBody: true,
          resBody: true,
          createdAt: true,
        },
      })
    : [];
  const errorsTop = topErrors(issueEvents);
  const slowTop = topSlowRequests(issueEvents);

  // Путь входа (лендинг) каждой сессии: самое раннее событие с адресом страницы.
  // distinct по sessionId при сортировке по времени возр. отдаёт первую запись сессии —
  // это страница, на которую пользователь зашёл в начале визита.
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

  // Группируем сессии по IP пользователя. Сессии уже отсортированы по последней
  // активности убыв., поэтому группы идут в порядке появления самой активной сессии.
  type Sess = (typeof sessions)[number];
  const ipGroupsMap = new Map<string, Sess[]>();
  for (const s of sessions) {
    const key = s.ip || "Без IP";
    const arr = ipGroupsMap.get(key);
    if (arr) arr.push(s);
    else ipGroupsMap.set(key, [s]);
  }
  const allIpGroups = Array.from(ipGroupsMap.entries()).map(([ip, list]) => {
    // Путь входа группы — страница самого раннего события среди сессий этого IP
    // (первый визит пользователя). Берём событие с минимальным временем создания.
    let entryUrl: string | null = null;
    let entryAt = Infinity;
    for (const s of list) {
      const fe = firstEventBySession.get(s.id);
      if (fe && fe.createdAt.getTime() < entryAt) {
        entryAt = fe.createdAt.getTime();
        entryUrl = fe.url;
      }
    }
    // Начало визита — самая ранняя сессия IP (список отсортирован по активности,
    // а не по старту, поэтому минимум ищем перебором).
    const startedAt = list.reduce(
      (min, s) => (s.startedAt < min ? s.startedAt : min),
      list[0].startedAt,
    );
    // Сессии отсортированы по последней активности убыв. — берём время последней
    // активности самой свежей сессии IP (она же первая в списке группы).
    const lastSeenAt = list[0].lastSeenAt;
    return {
    ip,
    list,
    entryPath: pageUrlToPath(entryUrl),
    lastSeenAt,
    // Длительность визита: от старта первой сессии IP до последнего действия.
    durationMs: lastSeenAt.getTime() - startedAt.getTime(),
    // Страна пользователя по IP: берём первый определённый код среди сессий группы.
    country: list.find((s) => s.country)?.country ?? null,
    errors: list.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0),
    slow: list.reduce((n, s) => n + (slowCount.get(s.id) ?? 0), 0),
    reports: list.reduce((n, s) => n + (reportCount.get(s.id) ?? 0), 0),
    };
  });

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
          Тариф сайта не активен — приём логов остановлен. Продлите тариф во
          вкладке «Тариф».
        </div>
      )}

      {usage.overLimit && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-200">
          <span className="font-semibold">
            Превышен суточный лимит сессий
          </span>{" "}
          ({usage.quota.toLocaleString("ru-RU")} в сутки). Новые сессии сегодня
          больше не принимаются.{" "}
          <Link
            href={`/dashboard/projects/${project.id}/tariff`}
            className="font-semibold underline underline-offset-2"
          >
            Повысьте тариф
          </Link>
          , чтобы увеличить лимит.
        </div>
      )}

      {!project.recordSession && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Запись сессий не включена — экран посетителей не записывается.
          Включите её во вкладке{" "}
          <Link
            href={`/dashboard/projects/${project.id}/connection`}
            className="font-semibold underline underline-offset-2"
          >
            «Подключение»
          </Link>
          , чтобы просматривать сессии как видео.
        </div>
      )}

      {/* Проверка, что SDK подключён на сайте. В компактном режиме баннер виден только,
          когда скрипт не найден / проверить не удалось. */}
      <SdkStatusCard projectId={project.id} compact />

      <ProjectExceptions exceptions={exceptions} />

      <TopIssues errors={errorsTop} slow={slowTop} projectId={project.id} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          <span>
            Сессии пользователей
            <span className="ml-2 text-slate-400">{ipGroups.length}</span>
          </span>
          {isToday && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
              title="Сессии с активностью за последние 5 минут"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Активных сейчас: {activeSessions}
            </span>
          )}
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
              <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <span className="shrink-0 text-sm text-slate-500">
                  {new Date(g.lastSeenAt).toLocaleTimeString("ru-RU")}
                </span>
                {g.country && (
                  <span
                    className="shrink-0 text-base leading-none"
                    title={g.country}
                    aria-label={g.country}
                  >
                    {flagEmoji(g.country)}
                  </span>
                )}
                <span className="hidden shrink-0 text-xs uppercase tracking-wide text-slate-400 sm:inline">
                  IP
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold">{g.ip}</span>
                <span
                  className="flex shrink-0 items-center gap-1 text-xs text-slate-500"
                  title="Длительность визита: от начала сессии до последнего действия"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {formatSessionLength(g.durationMs)}
                </span>
                {g.entryPath && (
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs text-slate-500 sm:max-w-[220px] sm:flex-none"
                    title={`Страница входа: ${g.entryPath}`}
                  >
                    {g.entryPath}
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-sm font-semibold">
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
