import Link from "next/link";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { normalizeActionLabel, type Departure } from "@/lib/breadcrumbs";

// Блок «Аналитика отказов» на вкладке логирования: агрегирует уходы с сайта
// (события SESSION_END) за выбранный день и показывает, какие последние действия
// пользователя им предшествовали. Departure'ы уже собраны на сервере (см.
// collectDepartures в src/lib/breadcrumbs.ts), здесь только группировки и вывод.

const TOP_LIMIT = 8; // сколько строк показывать в топах
const LIST_LIMIT = 100; // сколько уходов в развёрнутом списке

/** Топ значений по частоте: пары [ключ, количество], отсортированы по убыванию. */
function topEntries(map: Map<string, number>, limit = TOP_LIMIT): [string, number][] {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Инкремент счётчика в Map. */
function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function DepartureAnalytics({
  departures,
  projectId,
}: {
  departures: Departure[];
  projectId: string;
}) {
  const total = departures.length;

  // Группировки для топов.
  const exitPages = new Map<string, number>();
  const lastActions = new Map<string, number>();
  const chains = new Map<string, number>();

  for (const d of departures) {
    bump(exitPages, d.exitPage);
    if (d.actions.length) {
      // Последнее (ближайшее к уходу) действие — самое информативное.
      bump(lastActions, normalizeActionLabel(d.actions[d.actions.length - 1]));
      bump(chains, d.actions.map(normalizeActionLabel).join(" → "));
    }
  }

  const withActions = departures.filter((d) => d.actions.length > 0).length;

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Аналитика отказов</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Уходы с сайта за выбранный день и последние действия пользователя перед ними.
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
          За выбранную дату зафиксированных уходов нет.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Уходов" value={String(total)} />
            <Stat label="Страниц ухода" value={String(exitPages.size)} />
            <Stat label="С действиями" value={String(withActions)} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <TopList
              title="Страницы ухода"
              entries={topEntries(exitPages)}
              total={total}
              mono
            />
            <TopList
              title="Последнее действие"
              entries={topEntries(lastActions)}
              total={withActions}
            />
            <TopList
              title="Цепочки действий"
              entries={topEntries(chains)}
              total={withActions}
            />
          </div>

          <details className="mt-4 group">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-brand">
              Показать уходы с крошками ({Math.min(total, LIST_LIMIT)})
              <span className="text-xs text-slate-400 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-950/40">
                  <tr>
                    <th className="px-3 py-2 font-medium">Время</th>
                    <th className="px-3 py-2 font-medium">Страница ухода</th>
                    <th className="px-3 py-2 font-medium">Последние действия</th>
                    <th className="px-3 py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {departures.slice(0, LIST_LIMIT).map((d, i) => (
                    <tr
                      key={`${d.sessionId}-${i}`}
                      className="border-t border-slate-100 align-top dark:border-slate-800"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                        {new Date(d.at).toLocaleTimeString("ru-RU")}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{d.exitPage}</td>
                      <td className="px-3 py-2">
                        {d.actions.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {d.actions.map((a, j) => (
                              <span key={a.id} className="flex items-center gap-1">
                                {j > 0 && <span className="text-slate-300">→</span>}
                                <EventTypeIcon type={a.type} />
                                <span className="text-xs text-slate-600 dark:text-slate-300">
                                  {normalizeActionLabel(a)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Link
                          href={`/dashboard/projects/${projectId}/logging/${d.sessionId}`}
                          className="text-xs text-slate-400 hover:text-brand"
                        >
                          Сессия →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

/** Компактная плитка-счётчик. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}

/** Топ-список значений с долей от общего числа (полоска-барчик). */
function TopList({
  title,
  entries,
  total,
  mono,
}: {
  title: string;
  entries: [string, number][];
  total: number;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-400">Нет данных</p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map(([label, count]) => {
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={`min-w-0 flex-1 truncate text-xs text-slate-600 dark:text-slate-300 ${
                      mono ? "font-mono" : ""
                    }`}
                    title={label}
                  >
                    {label}
                  </span>
                  <span className="shrink-0 text-xs font-medium text-slate-500">
                    {count}
                    <span className="ml-1 text-slate-400">{pct}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
