import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { LogDateFilter } from "@/components/LogDateFilter";
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
  searchParams: { date?: string };
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
  const ipGroups = Array.from(ipGroupsMap.entries()).map(([ip, list]) => ({
    ip,
    list,
    events: list.reduce((n, s) => n + s._count.events, 0),
    errors: list.reduce((n, s) => n + (errorCount.get(s.id) ?? 0), 0),
  }));

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

      {/* Инструкция по подключению SDK */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          Подключение
        </h2>
        <p className="mt-1 text-sm text-slate-500">
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
      </div>

      <ProjectExceptions exceptions={exceptions} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Сессии пользователей</h2>
        <div className="flex items-center gap-3">
          <LogDateFilter value={dateStr} />
          <ClearLogsButton projectId={project.id} />
        </div>
      </div>

      {sessions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          За выбранную дату сессий нет.
        </p>
      ) : (
        <div className="space-y-4">
          {ipGroups.map((g) => (
            <div
              key={g.ip}
              className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
            >
              {/* Заголовок группы — IP пользователя и сводка */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-400">IP</span>
                  <span className="font-mono text-sm font-semibold">{g.ip}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>
                    {g.list.length} {pluralSess(g.list.length)} · {g.events} событий
                    {g.errors > 0 && (
                      <span className="text-red-600"> · {g.errors} ошибок</span>
                    )}
                  </span>
                  <Link
                    href={`/dashboard/projects/${project.id}/logging/combined?ip=${encodeURIComponent(g.ip)}&date=${dateStr}`}
                    className="whitespace-nowrap font-medium text-brand hover:underline"
                  >
                    Все события →
                  </Link>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-medium">Начало</th>
                      <th className="px-4 py-2 font-medium">Активность</th>
                      <th className="px-4 py-2 font-medium">События</th>
                      <th className="px-4 py-2 font-medium">Ошибки</th>
                      <th className="px-4 py-2 font-medium">Устройство</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.list.map((s) => {
                      const errs = errorCount.get(s.id) ?? 0;
                      return (
                        <tr
                          key={s.id}
                          className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
                        >
                          <td className="px-4 py-2">
                            <Link
                              href={`/dashboard/projects/${project.id}/logging/${s.id}`}
                              className="text-brand hover:underline"
                            >
                              {new Date(s.startedAt).toLocaleString("ru-RU")}
                            </Link>
                          </td>
                          <td className="px-4 py-2 text-slate-500">
                            {new Date(s.lastSeenAt).toLocaleTimeString("ru-RU")}
                          </td>
                          <td className="px-4 py-2">{s._count.events}</td>
                          <td className="px-4 py-2">
                            {errs > 0 ? (
                              <span className="text-red-600">{errs}</span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="px-4 py-2 max-w-[220px] truncate text-slate-400">
                            {s.userAgent ?? "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Склонение слова «сессия» по числу. */
function pluralSess(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "сессия";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "сессии";
  return "сессий";
}
