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
import { isProjectServiceActive } from "@/lib/subscription";
import { retentionDays } from "@/lib/logging";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

/** Локальная дата в формате YYYY-MM-DD. */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ERROR_TYPES = ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"];

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

  // Число «ошибочных» событий на каждую сессию (для колонки «Ошибки»).
  const ids = sessions.map((s) => s.id);
  const errorGroups = ids.length
    ? await prisma.logEvent.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: ids }, type: { in: ERROR_TYPES } },
        _count: { _all: true },
      })
    : [];
  const errorCount = new Map(errorGroups.map((g) => [g.sessionId, g._count._all]));

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
    errors: list.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0),
  }));

  // Фильтр «с ошибками»: при ?errors=1 показываем только группы, где были ошибки.
  const onlyErrors = searchParams?.errors === "1";
  const ipGroups = onlyErrors ? allIpGroups.filter((g) => g.errors > 0) : allIpGroups;

  // Активные правила-исключения проекта (игнор-лист) — блок управления над списком сессий.
  const exceptions = await prisma.logException.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, endpoint: true },
  });

  const snippet = `<script src="${appUrl()}/api/logger/sdk" async></script>`;

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

      {/* Инструкция по подключению SDK — скрыта по умолчанию */}
      <details className="group mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-slate-600 dark:text-slate-300">
          Подключение
          <span className="text-xs font-normal text-slate-400 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <p className="mt-3 text-sm text-slate-500">
          Вставьте один тег в <code className="font-mono">&lt;head&gt;</code> сайта{" "}
          <span className="font-mono">{project.domain}</span> — скрипт заработает
          автоматически. Ключ не нужен: события принимаются только с этого домена.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Скрипт ловит JS-ошибки, упавшие и медленные (&gt;500 мс) запросы,
          группирует их в сессии и отправляет батчами раз в 10 секунд. Логи
          хранятся {retentionDays(project.tier)}{" "}
          {retentionDays(project.tier) === 1 ? "сутки" : "суток"}.
        </p>
      </details>

      <ProjectExceptions exceptions={exceptions} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Сессии пользователей</h2>
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
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400">IP</span>
                <span className="font-mono text-sm font-semibold">{g.ip}</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">
                  {new Date(g.startedAt).toLocaleTimeString("ru-RU")}
                </span>
                {g.errors > 0 && (
                  <span className="flex items-center gap-1.5 font-semibold text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    {g.errors}
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
