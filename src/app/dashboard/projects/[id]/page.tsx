import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { StatusBadge } from "@/components/StatusBadge";
import { MonitorManager } from "@/components/MonitorManager";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export const dynamic = "force-dynamic";

const intervalLabel: Record<string, string> = {
  "1m": "каждую минуту",
  "1h": "каждый час",
  "1d": "каждый день",
};

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      monitors: {
        orderBy: { createdAt: "desc" },
        include: {
          // Последняя проверка — чтобы показать текст ошибки от сервера.
          results: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!project || project.userId !== userId) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
          ← К проектам
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-slate-500">{project.domain}</p>
          </div>
          <DeleteProjectButton projectId={project.id} />
        </div>
      </div>

      <MonitorManager projectId={project.id} projectDomain={project.domain} />

      <h2 className="mb-3 mt-8 text-lg font-semibold">Мониторы</h2>
      <div className="grid gap-3">
        {project.monitors.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            Добавьте монитор: URL, метод и периодичность проверки.
          </p>
        )}
        {project.monitors.map((m) => {
          const lastError = m.results[0]?.error ?? null;
          return (
            <Link
              key={m.id}
              href={`/dashboard/monitors/${m.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <StatusBadge status={m.lastStatus} />
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-800">
                      {m.method}
                    </span>{" "}
                    {m.url}
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-right text-xs text-slate-400">
                  {intervalLabel[m.interval]}
                  {m.lastCheckedAt && (
                    <div>
                      {new Date(m.lastCheckedAt).toLocaleString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
              {m.lastStatus === "DOWN" && lastError && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <span className="font-medium">Ошибка:</span> {lastError}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
