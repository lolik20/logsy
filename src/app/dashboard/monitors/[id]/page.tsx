import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { StatusBadge } from "@/components/StatusBadge";
import { MonitorActions } from "@/components/MonitorActions";
import { MonitorEdit } from "@/components/MonitorEdit";
import { StatusAutoRefresh } from "@/components/StatusAutoRefresh";
import { statusSignature } from "@/lib/status";

export const dynamic = "force-dynamic";

const intervalLabel: Record<string, string> = {
  "1m": "каждую минуту",
  "1h": "каждый час",
  "1d": "каждый день",
};

export default async function MonitorPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();
  const monitor = await prisma.monitor.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      results: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  // Владелец видит свой монитор; администратор — любой.
  if (!monitor || (monitor.project.userId !== userId && !admin)) notFound();

  // Редактирование и управление доступно только владельцу монитора.
  const isowner = monitor.project.userId === userId;

  // Уведомления шлются на email-контакты владельца. Если их нет — предупредим.
  const contactCount = isowner
    ? await prisma.contact.count({ where: { userId, type: "EMAIL" } })
    : 1;

  const total = monitor.results.length;
  const okCount = monitor.results.filter((r) => r.ok).length;
  const uptime = total > 0 ? Math.round((okCount / total) * 100) : null;
  const signature = statusSignature([monitor]);

  return (
    <div>
      <StatusAutoRefresh
        initialSignature={signature}
        monitorId={monitor.id}
        scope={admin ? "all" : undefined}
      />
      <Link
        href={`/dashboard/projects/${monitor.projectId}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сайту «{monitor.project.name}»
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{monitor.name}</h1>
            <StatusBadge status={monitor.lastStatus} />
          </div>
          <div className="mt-1 text-sm text-slate-500">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-slate-800">
              {monitor.method}
            </span>{" "}
            {monitor.url}
            {monitor.port != null && (
              <span className="text-slate-400"> · порт {monitor.port}</span>
            )}
          </div>
        </div>
        {isowner && (
          <MonitorActions monitorId={monitor.id} isActive={monitor.isActive} />
        )}
      </div>

      {contactCount === 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="font-semibold">Уведомления не настроены.</span> У вас
          нет контактов для оповещений — вы не узнаете, когда монитор станет
          недоступен.{" "}
          <Link
            href="/dashboard/contacts"
            className="font-medium text-amber-900 underline hover:no-underline dark:text-amber-100"
          >
            Добавьте контакты
          </Link>
          , чтобы получать уведомления.
        </div>
      )}

      {isowner && (
        <div className="mt-4">
          <MonitorEdit
            id={monitor.id}
            name={monitor.name}
            url={monitor.url}
            port={monitor.port}
            method={monitor.method}
            interval={monitor.interval}
            expectedStatus={monitor.expectedStatus}
            timeoutMs={monitor.timeoutMs}
            headers={monitor.headers}
            bodyType={monitor.bodyType}
            body={monitor.body}
          />
        </div>
      )}

      {!isowner && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Просмотр монитора пользователя «{monitor.project.name}» в режиме
          администратора.
        </div>
      )}

      {monitor.lastStatus === "DOWN" && monitor.results[0]?.error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-300">
          <span className="font-semibold">Последняя ошибка:</span>{" "}
          {monitor.results[0].error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Периодичность" value={intervalLabel[monitor.interval]} />
        <Stat label="Ожидаемый код" value={String(monitor.expectedStatus)} />
        <Stat
          label="Uptime (посл. 50)"
          value={uptime === null ? "—" : `${uptime}%`}
        />
        <Stat label="Проверок" value={String(total)} />
      </div>

      {(monitor.headers || (monitor.bodyType !== "NONE" && monitor.body)) && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Параметры запроса
          </h2>
          {monitor.headers && (
            <div className="mb-3">
              <div className="mb-1 text-xs text-slate-500">Заголовки</div>
              <div className="space-y-1">
                {Object.entries(
                  JSON.parse(monitor.headers) as Record<string, string>,
                ).map(([k, v]) => (
                  <div key={k} className="font-mono text-xs">
                    <span className="text-slate-500">{k}:</span> {v}
                  </div>
                ))}
              </div>
            </div>
          )}
          {monitor.bodyType !== "NONE" && monitor.body && (
            <div>
              <div className="mb-1 text-xs text-slate-500">
                Тело запроса ({monitor.bodyType})
              </div>
              <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
                {monitor.body}
              </pre>
            </div>
          )}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">История проверок</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Результат</th>
              <th className="px-4 py-2 font-medium">Код</th>
              <th className="px-4 py-2 font-medium">Отклик</th>
              <th className="px-4 py-2 font-medium">Детали</th>
            </tr>
          </thead>
          <tbody>
            {monitor.results.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Проверок ещё не было. Запустите воркер или дождитесь
                  следующего прогона.
                </td>
              </tr>
            )}
            {monitor.results.map((r) => (
              <tr
                key={r.id}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-4 py-2 text-slate-500">
                  {new Date(r.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2">
                  {r.ok ? (
                    <span className="text-green-600">OK</span>
                  ) : (
                    <span className="text-red-600">Ошибка</span>
                  )}
                </td>
                <td className="px-4 py-2">{r.statusCode ?? "—"}</td>
                <td className="px-4 py-2">
                  {r.responseTimeMs != null ? `${r.responseTimeMs} мс` : "—"}
                </td>
                <td className="px-4 py-2 text-slate-500">{r.error ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
