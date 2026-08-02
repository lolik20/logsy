import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function SessionPage({
  params,
}: {
  params: { id: string; sessionId: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const session = await prisma.logSession.findUnique({
    where: { id: params.sessionId },
    include: {
      project: { select: { id: true, name: true, userId: true } },
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (
    !session ||
    session.projectId !== params.id ||
    (session.project.userId !== userId && !admin)
  ) {
    notFound();
  }

  const errorCount = session.events.filter((e) =>
    ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"].includes(e.type),
  ).length;

  // Есть ли записанная запись экрана (rrweb) для этой сессии — от этого зависит показ плеера.
  const recordingChunks = await prisma.recordingChunk.count({
    where: { sessionId: session.id },
  });

  // Крошки перед уходом: id событий-действий, предшествующих каждому SESSION_END —
  // подсвечиваем их в ленте (см. collectDepartures в src/lib/breadcrumbs.ts).
  const breadcrumbIds = new Set(
    collectDepartures(session.events).flatMap((d) => d.actions.map((a) => a.id)),
  );

  // Реальный уход — только последнее событие SESSION_END сессии. Промежуточные
  // SESSION_END (выгрузка при переходе на другую страницу сайта, встречаются в старых
  // сессиях) отказом не отмечаем, чтобы «Отказ» не мелькал в нескольких местах ленты.
  const departureId = departureEventId(session.events);

  // Активные правила-исключения проекта — чтобы отметить уже подходящие события.
  const exceptions = await prisma.logException.findMany({
    where: { projectId: session.projectId },
    select: { kind: true, urlMode: true, url: true },
  });

  // Записи о статике (img / script / link-стили / css / шрифты) выносим из
  // основной ленты в отдельную свёрнутую вкладку, чтобы они не забивали список
  // значимых событий сессии. Статикой считаем не только замеры Resource Timing
  // (тип SLOW_RESOURCE), но и сетевые запросы (fetch/XHR — SLOW_REQUEST/HTTP_ERROR)
  // к статическим файлам: например, JS-чанки и стили бандлеров грузятся через
  // fetch и иначе остались бы в основной ленте. Определяем по расширению файла в
  // адресе запроса (см. isStaticAssetEvent). В основной таблице остаются переходы,
  // клики, ошибки приложения, запросы к API и т.д.
  const staticEvents = session.events.filter(isStaticAssetEvent);
  const mainEvents = session.events.filter((e) => !isStaticAssetEvent(e));

  // Одна строка ленты событий — используется и в основной таблице, и во вкладке
  // со статикой, чтобы разметка не дублировалась.
  const renderEventRow = (e: (typeof session.events)[number]) => (
    <tr
      key={e.id}
      className={`border-t border-slate-100 align-top dark:border-slate-800 ${
        e.type === "USER_REPORT"
          ? "border-l-2 border-l-violet-400 bg-violet-50/50 dark:bg-violet-900/10"
          : e.type === "RAGE_CLICK"
            ? "border-l-2 border-l-rose-400 bg-rose-50/50 dark:bg-rose-900/10"
            : e.id === departureId
              ? "bg-slate-50 dark:bg-slate-800/40"
              : ""
      }`}
    >
      <td className="px-4 py-2 whitespace-nowrap text-slate-500">
        {new Date(e.createdAt).toLocaleTimeString("ru-RU")}
      </td>
      <td className="px-4 py-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <EventTypeIcon type={e.type} />
          {e.type === "USER_REPORT" && (
            <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              Сообщение
            </span>
          )}
          {e.type === "RAGE_CLICK" && (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
              Rage
            </span>
          )}
          {e.id === departureId && (
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
          <div>
            <span className="whitespace-pre-wrap break-words font-medium text-violet-700 dark:text-violet-300">
              {e.message ?? "—"}
            </span>
            {emailFromMeta(e.meta) && (
              <a
                href={`mailto:${emailFromMeta(e.meta)}`}
                className="mt-1 block truncate font-mono text-xs text-violet-500 hover:underline"
              >
                ✉ {emailFromMeta(e.meta)}
              </a>
            )}
          </div>
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
                  projectId={session.project.id}
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
        href={`/dashboard/projects/${session.project.id}/logging`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сессиям сайта «{session.project.name}»
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Сессия</h1>
      <p className="text-sm text-slate-500">
        {new Date(session.startedAt).toLocaleTimeString("ru-RU")} —{" "}
        {new Date(session.lastSeenAt).toLocaleTimeString("ru-RU")}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <Stat label="Событий" value={String(session.events.length)} />
        <Stat label="Ошибок" value={String(errorCount)} />
        <Stat label="ID сессии" value={session.sessionKey} mono />
      </div>

      {session.userAgent && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold">User-Agent:</span> {session.userAgent}
        </div>
      )}

      {recordingChunks > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Запись экрана</h2>
          <Link
            href={`/dashboard/projects/${session.project.id}/logging/${session.id}/replay`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Смотреть запись
          </Link>
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">События</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
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
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  {staticEvents.length > 0
                    ? "Значимых событий нет — только статические ресурсы (ниже)."
                    : "В сессии нет событий."}
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
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Время</th>
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

/** Достаёт почту отправителя обратной формы из meta события (JSON), либо null. */
function emailFromMeta(meta: string | null): string | null {
  if (!meta) return null;
  try {
    const obj = JSON.parse(meta) as { email?: unknown };
    return typeof obj.email === "string" && obj.email ? obj.email : null;
  } catch {
    return null;
  }
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
