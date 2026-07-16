import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Человеко-читаемое время загрузки: «мс» до секунды, «с» — после. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

/** Цвет метрики скорости — та же градация, что и на публичной проверке. */
function speedClass(ms: number): string {
  if (ms < 1000) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 2500) return "text-amber-600 dark:text-amber-400";
  if (ms < 5000) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

export default async function SpeedTestsPage() {
  // Страница доступна только администраторам.
  if (!(await isAdmin())) notFound();

  const checks = await prisma.speedCheck.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Проверки скорости</h1>
        <p className="text-sm text-slate-500">
          Прогоны публичного инструмента проверки скорости сайта. Всего: {checks.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Домен</th>
              <th className="px-4 py-2 font-medium">Время прогона</th>
              <th className="px-4 py-2 font-medium">Скорость (DOM)</th>
            </tr>
          </thead>
          <tbody>
            {checks.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Проверок пока не было.
                </td>
              </tr>
            )}
            {checks.map((c) => (
              <tr
                key={c.id}
                className="border-t border-slate-100 dark:border-slate-800"
              >
                <td className="px-4 py-2">
                  <div className="font-medium">{c.domain}</div>
                  <div className="max-w-xs truncate text-xs text-slate-500">
                    {c.url}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {new Date(c.createdAt).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2">
                  <span className={`font-semibold ${speedClass(c.domContentLoadedMs)}`}>
                    {formatMs(c.domContentLoadedMs)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
