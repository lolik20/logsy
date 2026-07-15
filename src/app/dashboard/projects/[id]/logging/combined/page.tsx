import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { eventKind, eventUrl, matchesException } from "@/lib/exceptions";
import { collectDepartures } from "@/lib/breadcrumbs";
import { AddExceptionButton } from "@/components/AddExceptionButton";
import { EventTypeIcon } from "@/components/EventTypeIcon";

export const dynamic = "force-dynamic";

const ERROR_TYPES = ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"];

// Значение группы «без IP» в списке сессий (см. logging/page.tsx). Пробрасывается сюда
// как параметр ip — тогда фильтруем сессии, у которых ip пуст (null или "").
const NO_IP = "Без IP";

/** Локальная дата в формате YYYY-MM-DD. */
function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function CombinedIpPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ip?: string; date?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const ip = (searchParams?.ip ?? "").trim();
  if (!ip) notFound();

  const dateStr =
    searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
      ? searchParams.date
      : toDateInput(new Date());
  const dayStart = new Date(`${dateStr}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Сессии этого IP за выбранный день. «Без IP» → сессии с пустым ip (null или "").
  const ipWhere: Prisma.LogSessionWhereInput =
    ip === NO_IP ? { OR: [{ ip: null }, { ip: "" }] } : { ip };
  const sessions = await prisma.logSession.findMany({
    where: {
      projectId: project.id,
      startedAt: { gte: dayStart, lt: dayEnd },
      ...ipWhere,
    },
    orderBy: { startedAt: "asc" },
    select: { id: true, sessionKey: true, userAgent: true, startedAt: true },
  });

  if (sessions.length === 0) notFound();

  const sessionIds = sessions.map((s) => s.id);
  // Короткая метка сессии (первые символы ключа) — чтобы различать события разных
  // визитов/вкладок в общем списке, не открывая каждую сессию.
  const sessionTag = new Map(sessions.map((s) => [s.id, s.sessionKey.slice(0, 6)]));

  // Все события всех сессий этого IP — единым списком, по времени.
  const events = await prisma.logEvent.findMany({
    where: { sessionId: { in: sessionIds } },
    orderBy: { createdAt: "asc" },
  });

  const errorCount = events.filter((e) => ERROR_TYPES.includes(e.type)).length;

  // Крошки перед уходом: считаем по каждой сессии отдельно (события здесь идут единым
  // списком по времени, поэтому сперва группируем по sessionId).
  const eventsBySession = new Map<string, typeof events>();
  for (const e of events) {
    const arr = eventsBySession.get(e.sessionId);
    if (arr) arr.push(e);
    else eventsBySession.set(e.sessionId, [e]);
  }
  const breadcrumbIds = new Set<string>();
  for (const list of eventsBySession.values()) {
    for (const d of collectDepartures(list)) {
      for (const a of d.actions) breadcrumbIds.add(a.id);
    }
  }

  // Один User-Agent на IP-группу, если он общий для всех сессий (частый случай —
  // тот же пользователь), иначе не показываем (устройства разные).
  const uaSet = new Set(sessions.map((s) => s.userAgent ?? ""));
  const commonUa = uaSet.size === 1 ? sessions[0].userAgent : null;

  // Игнор-лист проекта — чтобы показать, какие события уже подходят под правило.
  const exceptions = await prisma.logException.findMany({
    where: { projectId: project.id },
    select: { kind: true, urlMode: true, url: true },
  });

  return (
    <div>
      <Link
        href={`/dashboard/projects/${project.id}/logging?date=${dateStr}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сессиям проекта «{project.name}»
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Все события пользователя</h1>
      <p className="text-sm text-slate-500">
        IP <span className="font-mono">{ip}</span> · {dateStr}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Событий" value={String(events.length)} />
        <Stat label="Ошибок" value={String(errorCount)} />
        <Stat label="Сессий" value={String(sessions.length)} />
        <Stat label="IP" value={ip} mono />
      </div>

      {commonUa && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold">User-Agent:</span> {commonUa}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">
        События ({events.length})
      </h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Сессия</th>
              <th className="px-4 py-2 font-medium">Тип</th>
              <th className="px-4 py-2 font-medium">Запрос</th>
              <th className="px-4 py-2 font-medium">Код</th>
              <th className="px-4 py-2 font-medium">Длит.</th>
              <th className="px-4 py-2 font-medium">Детали</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  Событий нет.
                </td>
              </tr>
            )}
            {events.map((e) => (
              <tr
                key={e.id}
                className={`border-t border-slate-100 align-top dark:border-slate-800 ${
                  e.type === "USER_REPORT"
                    ? "border-l-2 border-l-violet-400 bg-violet-50/50 dark:bg-violet-900/10"
                    : e.type === "SESSION_END"
                      ? "bg-slate-50 dark:bg-slate-800/40"
                      : breadcrumbIds.has(e.id)
                        ? "border-l-2 border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10"
                        : ""
                }`}
              >
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {new Date(e.createdAt).toLocaleTimeString("ru-RU")}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <Link
                    href={`/dashboard/projects/${project.id}/logging/${e.sessionId}`}
                    className="font-mono text-xs text-slate-400 hover:text-brand"
                  >
                    {sessionTag.get(e.sessionId) ?? "—"}
                  </Link>
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
                    {breadcrumbIds.has(e.id) && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        перед уходом
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
                  {e.durationMs != null ? `${e.durationMs} мс` : "—"}
                </td>
                <td className="px-4 py-2">
                  {e.stack || e.reqBody || e.resBody || e.query || (e.route && e.message) ? (
                    <details>
                      <summary className="cursor-pointer text-brand">Показать</summary>
                      {e.message && (
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          {e.message}
                        </div>
                      )}
                      {e.url && (
                        <div className="mt-1 text-xs text-slate-400">
                          Страница: {e.url}
                        </div>
                      )}
                      {e.query && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">
                            Query-параметры
                          </div>
                          <div className="mt-1 space-y-0.5">
                            {parseQuery(e.query).map(([k, v], i) => (
                              <div key={`${k}-${i}`} className="font-mono text-xs">
                                <span className="text-slate-500">{k}:</span> {v}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {e.reqBody && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">
                            Payload (тело запроса)
                          </div>
                          <pre className="mt-1 overflow-x-auto rounded bg-slate-50 p-2 text-xs dark:bg-slate-800">
                            {e.reqBody}
                          </pre>
                        </div>
                      )}
                      {e.resBody && (
                        <div className="mt-2">
                          <div className="text-xs font-medium text-slate-500">
                            Ответ сервера
                          </div>
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
                <td className="px-4 py-2 text-right">
                  {eventKind(e.type) && eventUrl(e) ? (
                    <AddExceptionButton
                      projectId={project.id}
                      eventType={e.type}
                      route={e.route}
                      url={e.url}
                      excluded={exceptions.some((rule) => matchesException(e, rule))}
                    />
                  ) : (
                    <span className="text-slate-300">—</span>
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

/** Разбирает query-строку в пары ключ/значение; при сбое возвращает как есть. */
function parseQuery(q: string): [string, string][] {
  try {
    const entries = Array.from(new URLSearchParams(q).entries());
    return entries.length ? entries : [[q, ""]];
  } catch {
    return [[q, ""]];
  }
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
