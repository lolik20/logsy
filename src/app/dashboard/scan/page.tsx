import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { SiteScanForm } from "@/components/SiteScanForm";

export const dynamic = "force-dynamic";

/** Человеко-читаемое время: «мс» до секунды, «с» — после. */
function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

export default async function ScanPage() {
  // Страница доступна только администраторам.
  if (!(await isAdmin())) notFound();

  const scans = await prisma.siteScan.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      domain: true,
      url: true,
      statusCode: true,
      pagesCrawled: true,
      errorsCount: true,
      slowCount: true,
      assetsCount: true,
      emailsCount: true,
      phonesCount: true,
      durationMs: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Обход сайта</h1>
        <p className="text-sm text-slate-500">
          Укажите адрес сайта и нажмите «Запуск» — бот обойдёт его настоящим headless-браузером
          и построит карту сайта с критическими моментами по каждой странице, покажет ошибки
          на сайте, медленные загрузки (дольше 2 с) и статику, а также соберёт почты и телефоны.
          Прежний отчёт при новом запуске остаётся на экране; любой прошлый обход можно открыть
          из истории ниже.
        </p>
      </div>

      <SiteScanForm />

      {/* История прогонов */}
      <div className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">История обходов</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 font-medium">Сайт</th>
                <th className="px-4 py-2 font-medium">Время</th>
                <th className="px-4 py-2 font-medium">Страниц</th>
                <th className="px-4 py-2 font-medium">Ошибок</th>
                <th className="px-4 py-2 font-medium">Медленных</th>
                <th className="px-4 py-2 font-medium">Статики</th>
                <th className="px-4 py-2 font-medium">Почт</th>
                <th className="px-4 py-2 font-medium">Телефонов</th>
                <th className="px-4 py-2 font-medium">Длит.</th>
                <th className="px-4 py-2 font-medium">Отчёт</th>
              </tr>
            </thead>
            <tbody>
              {scans.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    Обходов пока не было.
                  </td>
                </tr>
              )}
              {scans.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/50"
                >
                  <td className="px-4 py-2">
                    <Link href={`/dashboard/scan/${s.id}`} className="font-medium hover:text-brand">
                      {s.domain}
                    </Link>
                    <div className="max-w-xs truncate text-xs text-slate-500">{s.url}</div>
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(s.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-2">{s.pagesCrawled}</td>
                  <td className="px-4 py-2">
                    <span className={s.errorsCount ? "font-semibold text-red-600 dark:text-red-400" : "text-slate-400"}>
                      {s.errorsCount}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={s.slowCount ? "font-semibold text-amber-600 dark:text-amber-400" : "text-slate-400"}>
                      {s.slowCount}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{s.assetsCount}</td>
                  <td className="px-4 py-2 text-slate-500">{s.emailsCount}</td>
                  <td className="px-4 py-2 text-slate-500">{s.phonesCount}</td>
                  <td className="px-4 py-2 text-slate-500">{formatMs(s.durationMs)}</td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/dashboard/scan/${s.id}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Открыть →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
