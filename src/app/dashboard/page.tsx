import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectManager } from "@/components/ProjectManager";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusAutoRefresh } from "@/components/StatusAutoRefresh";
import { statusSignature } from "@/lib/status";
import { AdminMonitoring } from "@/components/AdminMonitoring";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = (await getUserId())!;

  // Администратор видит на вкладке «Мониторинг» проекты всех пользователей.
  if (await isAdmin()) {
    return <AdminMonitoring />;
  }

  const [projects, sub] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        monitors: {
          select: { id: true, lastStatus: true, lastCheckedAt: true },
        },
      },
    }),
    prisma.subscription.findUnique({ where: { userId } }),
  ]);

  const limit = sub?.sitesLimit ?? 1;
  const signature = statusSignature(projects.flatMap((p) => p.monitors));

  return (
    <div>
      <StatusAutoRefresh initialSignature={signature} />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Проекты</h1>
          <p className="text-sm text-slate-500">
            Сайтов: {projects.length} из {limit} по тарифу
          </p>
        </div>
      </div>

      <ProjectManager canAdd={projects.length < limit} />

      <div className="mt-6 grid gap-4">
        {projects.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            Пока нет проектов. Добавьте первый сайт для мониторинга.
          </p>
        )}
        {projects.map((p) => {
          const down = p.monitors.filter((m) => m.lastStatus === "DOWN").length;
          const status =
            p.monitors.length === 0
              ? "PENDING"
              : down > 0
                ? "DOWN"
                : "UP";
          return (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-brand dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="mt-1 text-sm text-slate-500">{p.domain}</div>
              </div>
              <div className="text-right text-sm text-slate-500">
                {p.monitors.length} монитор(ов)
                {down > 0 && (
                  <div className="text-red-600">{down} недоступно</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
