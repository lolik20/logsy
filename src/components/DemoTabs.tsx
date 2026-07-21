import Link from "next/link";

// Горизонтальные вкладки demo-сайта — повторяют ProjectServiceTabs подключённого проекта, но
// ведут на demo-страницы. Реализованы вкладки «Мониторинг» и «Сессии»; остальные функции
// показаны как аннотированные карточки на странице мониторинга demo-сайта.
const items = [
  { key: "monitoring", label: "Мониторинг", href: "/dashboard/demo" },
  { key: "logging", label: "Сессии", href: "/dashboard/demo/logging" },
];

export type DemoTabKey = "monitoring" | "logging";

export function DemoTabs({ active }: { active: DemoTabKey }) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
