import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { LogDateFilter } from "@/components/LogDateFilter";
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

  const snippet = `<script src="${appUrl()}/api/logger/sdk" async></script>`;

  return (
    <div>
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

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Сессии пользователей</h2>
        <LogDateFilter value={dateStr} />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Начало</th>
              <th className="px-4 py-2 font-medium">Активность</th>
              <th className="px-4 py-2 font-medium">События</th>
              <th className="px-4 py-2 font-medium">Ошибки</th>
              <th className="px-4 py-2 font-medium">Устройство</th>
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  За выбранную дату сессий нет.
                </td>
              </tr>
            )}
            {sessions.map((s) => {
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
  );
}
