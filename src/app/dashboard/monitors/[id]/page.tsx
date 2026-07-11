import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { StatusBadge } from "@/components/StatusBadge";
import { MonitorActions } from "@/components/MonitorActions";

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
  const monitor = await prisma.monitor.findUnique({
    where: { id: params.id },
    include: {
      project: true,
      results: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });

  if (!monitor || monitor.project.userId !== userId) notFound();

  const total = monitor.results.length;
  const okCount = monitor.results.filter((r) => r.ok).length;
  const uptime = total > 0 ? Math.round((okCount / total) * 100) : null;

  return (
    <div>
      <Link
        href={`/dashboard/projects/${monitor.projectId}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К проекту «{monitor.project.name}»
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
          </div>
        </div>
        <MonitorActions monitorId={monitor.id} isActive={monitor.isActive} />
      </div>

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

      <h2 className="mb-3 mt-8 text-lg font-semibold">История проверок</h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
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
