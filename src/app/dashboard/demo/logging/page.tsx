import Link from "next/link";
import { DemoTabs } from "@/components/DemoTabs";
import { DemoBanner, DemoNote } from "@/components/DemoNote";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { flagEmoji } from "@/lib/geo";
import { topErrors, topSlowRequests, ERROR_TYPES, type IssueEvent } from "@/lib/topIssues";
import {
  demoProject,
  demoSession,
  demoEvents,
  demoSessionStart,
  DEMO_SESSION_ID,
  FEATURES,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

const SESSION_HREF = "/dashboard/demo/logging/session";

// Демо-страница «Сессии»: список пользовательских сессий, топ ошибок и медленных запросов —
// на тестовых данных. Каждый блок сопровождается пояснением к соответствующей функции.
export default function DemoLoggingPage() {
  const startedAt = demoSessionStart();
  const events = demoEvents(startedAt);

  // Сводим события тестовой сессии в топы теми же чистыми функциями, что и на реальном сайте.
  const issueEvents: IssueEvent[] = events.map((e) => ({
    id: e.id,
    sessionId: DEMO_SESSION_ID,
    type: e.type,
    message: e.message,
    route: e.route,
    method: e.method,
    statusCode: e.statusCode,
    durationMs: e.durationMs,
    url: e.url,
    reqBody: e.reqBody,
    resBody: e.resBody,
    createdAt: e.createdAt,
  }));
  const errorsTop = topErrors(issueEvents);
  const slowTop = topSlowRequests(issueEvents);

  const errorCount = events.filter((e) => ERROR_TYPES.includes(e.type as (typeof ERROR_TYPES)[number])).length;
  const slowCount = events.filter((e) => e.type === "SLOW_REQUEST").length;
  const reportCount = events.filter((e) => e.type === "USER_REPORT").length;

  return (
    <div>
      <DemoBanner />

      <div className="mb-6">
        <Link href="/dashboard/demo" className="text-sm text-slate-500 hover:text-brand">
          ← К мониторингу
        </Link>
        <div className="mt-2">
          <h1 className="text-2xl font-bold">{demoProject.name}</h1>
          <p className="text-sm text-slate-500">{demoProject.domain}</p>
        </div>
        <DemoTabs active="logging" />
      </div>

      <DemoNote feature={FEATURES.sessions} />

      {/* Топ ошибок и медленных запросов */}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <DemoNote feature={FEATURES.errors} />
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Топ 10 ошибок</h2>
            <span className="shrink-0 text-xs text-slate-400">за день</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {errorsTop.map((e, i) => (
              <li key={e.key}>
                <Link
                  href={SESSION_HREF}
                  className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                  <EventTypeIcon type={e.type} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200" title={e.label}>
                    {e.label}
                  </span>
                  {e.statusCode != null && (
                    <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                      {e.statusCode}
                    </span>
                  )}
                  <span className="shrink-0 text-sm font-semibold text-slate-500">×{e.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <DemoNote feature={FEATURES.slow} />
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Топ 10 медленных запросов</h2>
            <span className="shrink-0 text-xs text-slate-400">по макс. времени</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {slowTop.map((s, i) => (
              <li key={`${s.method ?? ""} ${s.endpoint}`}>
                <Link
                  href={SESSION_HREF}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <span className="w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                  {s.method && (
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                      {s.method}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200" title={s.endpoint}>
                    {s.endpoint}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {s.maxMs} мс
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Список пользовательских сессий (сгруппированы по IP) */}
      <h2 className="mb-4 text-lg font-semibold">
        Сессии пользователей<span className="ml-2 text-slate-400">1</span>
      </h2>
      <DemoNote feature={FEATURES.replay} />
      <Link
        href={SESSION_HREF}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-brand hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {startedAt.toLocaleTimeString("ru-RU")}
          </span>
          <span className="text-base leading-none" title={demoSession.country} aria-label={demoSession.country}>
            {flagEmoji(demoSession.country)}
          </span>
          <span className="text-xs uppercase tracking-wide text-slate-400">IP</span>
          <span className="font-mono text-sm font-semibold">{demoSession.ip}</span>
        </div>
        <div className="flex items-center gap-3 text-sm font-semibold">
          {reportCount > 0 && (
            <span className="flex items-center gap-1 text-violet-600" title="Сообщения пользователя">
              <EventTypeIcon type="USER_REPORT" />
              {reportCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="flex items-center gap-1.5 text-red-600">
              <span className="h-2 w-2 rounded-full bg-red-600" />
              {errorCount}
            </span>
          )}
          {slowCount > 0 && (
            <span className="flex items-center gap-1.5 text-amber-500">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {slowCount}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
