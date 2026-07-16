import Link from "next/link";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import type { TopError, TopSlow } from "@/lib/topIssues";

// Блок «Топ ошибок и медленных запросов» на вкладке логирования: за выбранный день
// показывает 10 самых частых ошибок и 10 самых медленных запросов сайта. Данные уже
// свёрнуты на сервере (topErrors / topSlowRequests в src/lib/topIssues.ts), здесь
// только вывод. Каждая строка ведёт в самую свежую сессию с этим событием.

export function TopIssues({
  errors,
  slow,
  projectId,
}: {
  errors: TopError[];
  slow: TopSlow[];
  projectId: string;
}) {
  const sessionHref = (sessionId: string) =>
    `/dashboard/projects/${projectId}/logging/${sessionId}`;

  return (
    <section className="mb-6 grid gap-4 md:grid-cols-2">
      {/* Топ ошибок */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Топ 10 ошибок</h2>
          <span className="text-xs text-slate-400">за день</span>
        </div>
        {errors.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            Ошибок за выбранную дату нет.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {errors.map((e, i) => (
              <li key={e.key}>
                <Link
                  href={sessionHref(e.sessionId)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="w-4 shrink-0 text-right text-xs text-slate-400">
                    {i + 1}
                  </span>
                  <EventTypeIcon type={e.type} />
                  <span
                    className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200"
                    title={e.label}
                  >
                    {e.label}
                  </span>
                  {e.statusCode != null && (
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      {e.statusCode}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-semibold text-slate-500">
                    ×{e.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Топ медленных запросов */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Топ 10 медленных запросов</h2>
          <span className="text-xs text-slate-400">по макс. времени</span>
        </div>
        {slow.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            Медленных запросов за выбранную дату нет.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {slow.map((s, i) => (
              <li key={`${s.method ?? ""} ${s.endpoint}`}>
                <Link
                  href={sessionHref(s.sessionId)}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="w-4 shrink-0 text-right text-xs text-slate-400">
                    {i + 1}
                  </span>
                  {s.method && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                      {s.method}
                    </span>
                  )}
                  <span
                    className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200"
                    title={s.endpoint}
                  >
                    {s.endpoint}
                  </span>
                  {s.count > 1 && (
                    <span className="shrink-0 text-xs text-slate-400" title="Число запросов">
                      ×{s.count}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {s.maxMs} мс
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
