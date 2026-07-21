import Link from "next/link";
import { DemoBanner, DemoNote } from "@/components/DemoNote";
import { EventTypeIcon } from "@/components/EventTypeIcon";
import { SessionReplay } from "@/components/SessionReplay";
import { formatDurationSec } from "@/lib/logging";
import {
  demoSession,
  demoEvents,
  demoSessionStart,
  DEMO_SESSION_ID,
  FEATURES,
} from "@/lib/demo";

export const dynamic = "force-dynamic";

const ERROR_TYPES = ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"];

// Демо-страница отдельной (тестовой) сессии: запись экрана как видео с маркерами ошибок и
// медленных запросов + полная лента событий. Всё на синтетических данных.
export default function DemoSessionPage() {
  const startedAt = demoSessionStart();
  const events = demoEvents(startedAt);
  const errorCount = events.filter((e) => ERROR_TYPES.includes(e.type)).length;
  const slowCount = events.filter((e) => e.type === "SLOW_REQUEST").length;

  return (
    <div>
      <DemoBanner />

      <Link href="/dashboard/demo/logging" className="text-sm text-slate-500 hover:text-brand">
        ← К сессиям сайта «Demo Shop»
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Тестовая сессия пользователя</h1>
      <p className="text-sm text-slate-500">
        IP <span className="font-mono">{demoSession.ip}</span> ·{" "}
        {startedAt.toLocaleString("ru-RU")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Событий" value={String(events.length)} />
        <Stat label="Ошибок" value={String(errorCount)} />
        <Stat label="Медленных" value={String(slowCount)} />
        <Stat label="IP" value={demoSession.ip} mono />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <span className="font-semibold">User-Agent:</span> {demoSession.userAgent}
      </div>

      {/* Запись экрана */}
      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Запись экрана</h2>
        <DemoNote feature={FEATURES.replay} />
        <SessionReplay sessionId={DEMO_SESSION_ID} className="mt-0" autoLoad />
      </div>

      {/* Лента событий */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">События ({events.length})</h2>
      <DemoNote feature={FEATURES.errors} />
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Тип</th>
              <th className="px-4 py-2 font-medium">Запрос / сообщение</th>
              <th className="px-4 py-2 font-medium">Код</th>
              <th className="px-4 py-2 font-medium">Длит.</th>
              <th className="px-4 py-2 font-medium">Детали</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-slate-100 align-top dark:border-slate-800 ${
                  e.type === "USER_REPORT"
                    ? "border-l-2 border-l-violet-400 bg-violet-50/50 dark:bg-violet-900/10"
                    : e.type === "SESSION_END"
                      ? "bg-slate-50 dark:bg-slate-800/40"
                      : ""
                }`}
              >
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {e.createdAt.toLocaleTimeString("ru-RU")}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <EventTypeIcon type={e.type} />
                    {e.type === "USER_REPORT" && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        Сообщение
                      </span>
                    )}
                    {e.type === "SESSION_END" && (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                        Отказ
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 max-w-[280px]">
                  {e.route ? (
                    <div className="truncate">
                      {e.method && (
                        <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
                          {e.method}
                        </span>
                      )}
                      <span className="font-mono text-xs">{e.route}</span>
                    </div>
                  ) : e.type === "USER_REPORT" ? (
                    <span className="whitespace-pre-wrap break-words font-medium text-violet-700 dark:text-violet-300">
                      {e.message ?? "—"}
                    </span>
                  ) : (
                    <span className="text-slate-500">{e.message ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">{e.statusCode ?? "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {e.durationMs != null ? formatDurationSec(e.durationMs) : "—"}
                </td>
                <td className="px-4 py-2">
                  {e.stack || e.reqBody || e.resBody ? (
                    <details>
                      <summary className="cursor-pointer text-brand">Показать</summary>
                      {e.reqBody && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">Payload (тело запроса)</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                            {e.reqBody}
                          </pre>
                        </div>
                      )}
                      {e.resBody && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">Ответ сервера</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                            {e.resBody}
                          </pre>
                        </div>
                      )}
                      {e.stack && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">Стек</div>
                          <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                            {e.stack}
                          </pre>
                        </div>
                      )}
                    </details>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 truncate text-lg font-semibold ${mono ? "font-mono text-sm" : ""}`}>
        {value}
      </div>
    </div>
  );
}
