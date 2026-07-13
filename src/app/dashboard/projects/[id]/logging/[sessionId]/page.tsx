import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  ERROR: "JS-ошибка",
  UNHANDLED_REJECTION: "Promise reject",
  HTTP_ERROR: "Ошибка запроса",
  SLOW_REQUEST: "Медленный запрос",
};

const TYPE_TONE: Record<string, string> = {
  ERROR: "text-red-600",
  UNHANDLED_REJECTION: "text-red-600",
  HTTP_ERROR: "text-orange-600",
  SLOW_REQUEST: "text-amber-600",
};

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

  return (
    <div>
      <Link
        href={`/dashboard/projects/${session.project.id}/logging`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сессиям проекта «{session.project.name}»
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Сессия</h1>
      <p className="text-sm text-slate-500">
        {new Date(session.startedAt).toLocaleString("ru-RU")} —{" "}
        {new Date(session.lastSeenAt).toLocaleString("ru-RU")}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Событий" value={String(session.events.length)} />
        <Stat label="Ошибок" value={String(errorCount)} />
        <Stat label="ID сессии" value={session.sessionKey} mono />
        <Stat label="IP" value={session.ip ?? "—"} mono />
      </div>

      {session.userAgent && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          <span className="font-semibold">User-Agent:</span> {session.userAgent}
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
            </tr>
          </thead>
          <tbody>
            {session.events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  В сессии нет событий.
                </td>
              </tr>
            )}
            {session.events.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top dark:border-slate-800">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {new Date(e.createdAt).toLocaleTimeString("ru-RU")}
                </td>
                <td className={`px-4 py-2 whitespace-nowrap font-medium ${TYPE_TONE[e.type] ?? ""}`}>
                  {TYPE_LABEL[e.type] ?? e.type}
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
                  ) : (
                    <span className="text-slate-500">{e.message ?? "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2">{e.statusCode ?? "—"}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {e.durationMs != null ? `${e.durationMs} мс` : "—"}
                </td>
                <td className="px-4 py-2">
                  {e.stack || e.reqBody || e.query || (e.route && e.message) ? (
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
