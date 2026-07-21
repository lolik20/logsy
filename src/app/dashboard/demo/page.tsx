import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { DemoTabs } from "@/components/DemoTabs";
import { DemoBanner, DemoNote } from "@/components/DemoNote";
import { demoProject, demoMonitors, FEATURES } from "@/lib/demo";

export const dynamic = "force-dynamic";

const intervalLabel: Record<string, string> = {
  "1m": "каждую минуту",
  "1h": "каждый час",
  "1d": "каждый день",
};

// Демо-страница «Мониторинг»: показывает весь внутренний функционал панели на тестовых данных
// так же, как на подключённом сайте. Каждый блок сопровождается пояснением (DemoNote).
export default function DemoMonitoringPage() {
  const down = demoMonitors.filter((m) => m.status === "DOWN").length;

  return (
    <div>
      <DemoBanner />

      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
          ← К сайтам
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{demoProject.name}</h1>
              <StatusBadge status={down > 0 ? "DOWN" : "UP"} />
            </div>
            <p className="text-sm text-slate-500">{demoProject.domain}</p>
          </div>
        </div>
        <DemoTabs active="monitoring" />
      </div>

      {/* SSL и домен */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <DemoNote feature={FEATURES.ssl} />
          <div className="flex items-center justify-between">
            <span className="font-semibold">SSL-сертификат</span>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Действителен
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {demoProject.sslIssuer} · осталось {demoProject.sslDaysLeft} дн.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <DemoNote feature={FEATURES.domain} />
          <div className="flex items-center justify-between">
            <span className="font-semibold">Домен</span>
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
              Активен
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {demoProject.domainRegistrar} · осталось {demoProject.domainDaysLeft} дн.
          </p>
        </div>
      </div>

      {/* Мониторы */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Мониторы</h2>
      <DemoNote feature={FEATURES.monitoring} />
      <div className="grid gap-3">
        {demoMonitors.map((m) => (
          <div
            key={m.id}
            className="block rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{m.name}</span>
                  <StatusBadge status={m.status} />
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
                {m.responseMs != null && <div>{m.responseMs} мс</div>}
              </div>
            </div>
            {m.status === "DOWN" && m.error && (
              <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                <span className="font-medium">Ошибка:</span> {m.error}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Обзор остальных функций панели — с пояснением к каждой */}
      <h2 className="mb-3 mt-8 text-lg font-semibold">Что ещё умеет панель</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { f: FEATURES.sessions, href: "/dashboard/demo/logging", cta: "Открыть сессии" },
          { f: FEATURES.replay, href: "/dashboard/demo/logging/session", cta: "Смотреть запись" },
          { f: FEATURES.errors, href: "/dashboard/demo/logging", cta: null },
          { f: FEATURES.slow, href: "/dashboard/demo/logging", cta: null },
          { f: FEATURES.feedback, href: null, cta: null },
          { f: FEATURES.tasks, href: null, cta: null },
          { f: FEATURES.pages, href: null, cta: null },
          { f: FEATURES.contacts, href: null, cta: null },
          { f: FEATURES.tariff, href: null, cta: null },
        ].map(({ f, href, cta }) => (
          <div
            key={f.title}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="font-semibold">{f.title}</span>
            <p className="mt-1 flex-1 text-sm text-slate-500">{f.text}</p>
            {href && cta && (
              <Link
                href={href}
                className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-brand hover:underline"
              >
                {cta} →
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
