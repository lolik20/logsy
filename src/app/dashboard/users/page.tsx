import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { describeSubscription, isFreePlan } from "@/lib/subscription";
import { AdminUserTariff } from "@/components/AdminUserTariff";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  // Страница доступна только администраторам.
  if (!(await isAdmin())) notFound();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      _count: { select: { projects: true } },
    },
  });

  // Считаем число мониторов на пользователя (по всем его проектам).
  const monitorGroups = await prisma.monitor.groupBy({
    by: ["projectId"],
    _count: { _all: true },
  });
  const projects = await prisma.project.findMany({
    select: { id: true, userId: true },
  });
  const monitorsByUser = new Map<string, number>();
  const projectOwner = new Map(projects.map((p) => [p.id, p.userId]));
  for (const g of monitorGroups) {
    const owner = projectOwner.get(g.projectId);
    if (owner) {
      monitorsByUser.set(
        owner,
        (monitorsByUser.get(owner) ?? 0) + g._count._all,
      );
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Пользователи</h1>
        <p className="text-sm text-slate-500">Всего: {users.length}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Пользователь</th>
              <th className="px-4 py-2 font-medium">Роль</th>
              <th className="px-4 py-2 font-medium">Подписка</th>
              <th className="px-4 py-2 font-medium">Тариф</th>
              <th className="px-4 py-2 font-medium">Сайты</th>
              <th className="px-4 py-2 font-medium">Мониторы</th>
              <th className="px-4 py-2 font-medium">Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Пользователей пока нет.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const isAdminUser = u.role === "ADMIN";
              const sub = describeSubscription(u.subscription, isAdminUser);
              return (
                <tr
                  key={u.id}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.name || "—"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        isAdminUser
                          ? "bg-brand-50 text-brand dark:bg-brand/15"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isAdminUser ? "Администратор" : "Пользователь"}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        sub.tone === "inactive"
                          ? "text-red-600 dark:text-red-400"
                          : sub.tone === "free"
                            ? "text-green-700 dark:text-green-300"
                            : "text-brand"
                      }
                    >
                      {sub.label}
                    </span>
                    {sub.showPeriodEnd && sub.periodEnd && (
                      <div className="text-xs text-slate-400">
                        до {sub.periodEnd}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isAdminUser ? (
                      <span className="text-xs text-slate-400">безлимит</span>
                    ) : (
                      <AdminUserTariff
                        userId={u.id}
                        isPaid={!isFreePlan(u.subscription)}
                        currentPeriodEnd={
                          u.subscription?.currentPeriodEnd
                            ? new Date(u.subscription.currentPeriodEnd).toISOString()
                            : null
                        }
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">{u._count.projects}</td>
                  <td className="px-4 py-2">{monitorsByUser.get(u.id) ?? 0}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString("ru-RU")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
