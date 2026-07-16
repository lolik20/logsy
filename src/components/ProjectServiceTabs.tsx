import Link from "next/link";

// Горизонтальные вкладки сервисов проекта (дублируют второй уровень бокового меню,
// удобно на мобильных, где сайдбар скрыт). active — ключ текущего сервиса.
const items = [
  { key: "monitoring", label: "Мониторинг", suffix: "" },
  { key: "logging", label: "Логирование", suffix: "/logging" },
  { key: "tasks", label: "Задачи", suffix: "/tasks" },
  { key: "pages", label: "Страницы", suffix: "/pages" },
  { key: "connection", label: "Подключение", suffix: "/connection" },
  { key: "contacts", label: "Контакты", suffix: "/contacts" },
  { key: "alerts", label: "Алерты", suffix: "/alerts" },
  { key: "tariff", label: "Тариф", suffix: "/tariff" },
];

export type ProjectServiceKey =
  | "monitoring"
  | "logging"
  | "tasks"
  | "pages"
  | "connection"
  | "contacts"
  | "alerts"
  | "tariff";

export function ProjectServiceTabs({
  projectId,
  active,
}: {
  projectId: string;
  active: ProjectServiceKey;
}) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {items.map((it) => {
        const isActive = it.key === active;
        return (
          <Link
            key={it.key}
            href={`/dashboard/projects/${projectId}${it.suffix}`}
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
