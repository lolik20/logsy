import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusAutoRefresh } from "@/components/StatusAutoRefresh";
import { statusSignature } from "@/lib/status";

// Панель мониторинга для администратора: проекты всех пользователей с
// возможностью открыть каждый проект и его мониторы.
export async function AdminMonitoring() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      projects: {
        orderBy: { createdAt: "desc" },
        include: {
          monitors: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              name: true,
              url: true,
              method: true,
              lastStatus: true,
              lastCheckedAt: true,
            },
          },
        },
      },
    },
  });

  const allMonitors = users.flatMap((u) =>
    u.projects.flatMap((p) => p.monitors),
  );
  const signature = statusSignature(allMonitors);

  const projectCount = users.reduce((n, u) => n + u.projects.length, 0);
  const downCount = allMonitors.filter((m) => m.lastStatus === "DOWN").length;

  // Показываем только пользователей, у которых есть проекты.
  const usersWithProjects = users.filter((u) => u.projects.length > 0);

  return (
    <div>
      {/* Для админа опрашиваем статусы всех мониторов (scope=all). */}
      <StatusAutoRefresh initialSignature={signature} scope="all" />

      <div className="mb-6">
        <h1 className="text-2xl font-bold">Мониторинг · все проекты</h1>
        <p className="text-sm text-slate-500">
          Проектов: {projectCount} · мониторов: {allMonitors.length}
          {downCount > 0 && (
            <span className="text-red-600"> · {downCount} недоступно</span>
          )}
        </p>
      </div>

      {/* Администратор может создавать свои проекты без ограничений тарифа. */}
      <div className="mb-8">
        <Link
          href="/dashboard/projects/new"
          className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Добавить проект
        </Link>
      </div>

      {usersWithProjects.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          Пока ни у одного пользователя нет проектов.
        </p>
      )}

      <div className="space-y-8">
        {usersWithProjects.map((u) => (
          <section key={u.id}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {u.name || u.email}
              </h2>
              <span className="text-xs text-slate-400">{u.email}</span>
              <span className="text-xs text-slate-400">
                · {u.projects.length} проект(ов)
              </span>
            </div>

            <div className="grid gap-4">
              {u.projects.map((p) => {
                const down = p.monitors.filter(
                  (m) => m.lastStatus === "DOWN",
                ).length;
                const status =
                  p.monitors.length === 0
                    ? "PENDING"
                    : down > 0
                      ? "DOWN"
                      : "UP";
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <Link
                      href={`/dashboard/projects/${p.id}`}
                      className="flex items-center justify-between hover:text-brand"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">{p.name}</span>
                        <StatusBadge status={status} />
                      </div>
                      <div className="text-right text-sm text-slate-500">
                        {p.domain}
                        {down > 0 && (
                          <div className="text-red-600">{down} недоступно</div>
                        )}
                      </div>
                    </Link>

                    {p.monitors.length > 0 && (
                      <div className="mt-4 grid gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                        {p.monitors.map((m) => (
                          <Link
                            key={m.id}
                            href={`/dashboard/monitors/${m.id}`}
                            className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <StatusBadge status={m.lastStatus} />
                              <span className="truncate text-sm font-medium">
                                {m.name}
                              </span>
                              <span className="truncate text-xs text-slate-400">
                                {m.method} {m.url}
                              </span>
                            </div>
                            <span className="ml-3 shrink-0 text-xs text-slate-400">
                              {m.lastCheckedAt
                                ? new Date(m.lastCheckedAt).toLocaleString(
                                    "ru-RU",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                      day: "2-digit",
                                      month: "2-digit",
                                    },
                                  )
                                : "—"}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
