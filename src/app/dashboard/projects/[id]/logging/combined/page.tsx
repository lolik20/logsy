import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { eventKind, eventUrl, matchesException } from "@/lib/exceptions";
import { isStaticAssetEvent } from "@/lib/staticAssets";
import { collectDepartures, departureEventId } from "@/lib/breadcrumbs";
import { formatDurationSec, truncateUrl } from "@/lib/logging";
import { AddExceptionButton } from "@/components/AddExceptionButton";
import { CopyEventButton } from "@/components/CopyEventButton";
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

  // Записи экрана (rrweb) сессий этого IP. Раньше плеер был только на странице отдельной
  // сессии (logging/[sessionId]), а сюда — на основной экран, куда ведёт список сессий, —
  // пользователь попадал минуя её, и записи «не появлялись». Показываем их прямо здесь:
  // считаем чанки по каждой сессии и рендерим плеер для тех, у кого запись есть.
  const recCounts = sessionIds.length
    ? await prisma.recordingChunk.groupBy({
        by: ["sessionId"],
        where: { sessionId: { in: sessionIds } },
        _count: { _all: true },
      })
    : [];
  const recordedIds = new Set(
    recCounts.filter((r) => r._count._all > 0).map((r) => r.sessionId),
  );
  // Порядок — как у сессий (по времени возр.), чтобы записи шли в хронологии визитов.
  const recordedSessions = sessions.filter((s) => recordedIds.has(s.id));

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
  // Реальный уход каждой сессии — только последнее SESSION_END (см. departureEventId).
  // Промежуточные SESSION_END (переходы между страницами) отказом не отмечаем.
  const departureIds = new Set<string>();
  for (const list of eventsBySession.values()) {
    for (const d of collectDepartures(list)) {
      for (const a of d.actions) breadcrumbIds.add(a.id);
    }
    const dep = departureEventId(list);
    if (dep) departureIds.add(dep);
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

  // Статику (повторяющиеся запросы к JS/CSS/картинкам/шрифтам) выносим из основной
  // ленты в отдельную свёрнутую вкладку — так же, как на странице отдельной сессии
  // (см. logging/[sessionId]/page.tsx). В общих логах IP таких записей особенно много:
  // одни и те же бандлы и картинки грузятся в каждой сессии и заслоняют значимые
  // события. Определяем статику по расширению файла в адресе запроса (isStaticAssetEvent).
  const staticEvents = events.filter(isStaticAssetEvent);
  const mainEvents = events.filter((e) => !isStaticAssetEvent(e));

  // Одна строка ленты событий — используется и в основной таблице, и во вкладке со
  // статикой, чтобы разметка не дублировалась.
  const renderEventRow = (e: (typeof events)[number]) => (
    <tr
      key={e.id}
      className={`border-t border-slate-100 align-top dark:border-slate-800 ${
        e.type === "USER_REPORT"
          ? "border-l-2 border-l-violet-400 bg-violet-50/50 dark:bg-violet-900/10"
          : departureIds.has(e.id)
            ? "bg-slate-50 dark:bg-slate-800/40"
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
          {departureIds.has(e.id) && (
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
        {e.durationMs != null ? formatDurationSec(e.durationMs) : "—"}
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
                Страница:{" "}
                <span className="break-all" title={e.url}>
                  {truncateUrl(e.url)}
                </span>
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
      <td className="px-4 py-2">
        {(() => {
          const showCopy =
            ERROR_TYPES.includes(e.type) ||
            !!(e.route || e.reqBody || e.resBody || e.statusCode != null);
          const showException = !!(eventKind(e.type) && eventUrl(e));
          if (!showCopy && !showException)
            return <span className="text-slate-300">—</span>;
          return (
            <div className="flex items-center justify-end gap-2">
              {showCopy && (
                <CopyEventButton
                  data={{
                    message: e.message,
                    page: e.url,
                    method: e.method,
                    requestUrl: e.route,
                    reqBody: e.reqBody,
                    resBody: e.resBody,
                    statusCode: e.statusCode,
                  }}
                />
              )}
              {showException && (
                <AddExceptionButton
                  projectId={project.id}
                  eventType={e.type}
                  route={e.route}
                  url={e.url}
                  excluded={exceptions.some((rule) => matchesException(e, rule))}
                />
              )}
            </div>
          );
        })()}
      </td>
    </tr>
  );

  return (
    <div>
      <Link
        href={`/dashboard/projects/${project.id}/logging?date=${dateStr}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сессиям сайта «{project.name}»
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

      {recordedSessions.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">
            Записи экрана ({recordedSessions.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {recordedSessions.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/projects/${project.id}/logging/${s.id}/replay`}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm hover:border-brand hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800/50"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-brand"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                <span>
                  Смотреть запись
                  <span className="ml-2 font-mono text-xs text-slate-400">
                    {sessionTag.get(s.id) ?? s.id.slice(0, 6)} ·{" "}
                    {new Date(s.startedAt).toLocaleTimeString("ru-RU")}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">
        События ({mainEvents.length})
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
            {mainEvents.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  {staticEvents.length > 0
                    ? "Значимых событий нет — только статические ресурсы (ниже)."
                    : "Событий нет."}
                </td>
              </tr>
            )}
            {mainEvents.map(renderEventRow)}
          </tbody>
        </table>
      </div>

      {staticEvents.length > 0 && (
        <details className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <summary className="flex cursor-pointer items-center gap-2 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 hover:text-brand dark:bg-slate-900 dark:text-slate-300">
            Статические ресурсы
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-200">
              {staticEvents.length}
            </span>
          </summary>
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
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
              <tbody>{staticEvents.map(renderEventRow)}</tbody>
            </table>
          </div>
        </details>
      )}
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
