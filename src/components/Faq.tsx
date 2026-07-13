import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };

// Компактный сворачиваемый FAQ. Без клиентского JS — на нативных <details>,
// поэтому его можно использовать и в серверных, и в клиентских компонентах.
export function Faq({
  items,
  title = "Как это работает",
  className = "",
}: {
  items: FaqItem[];
  title?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <h2 className="mb-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
        {title}
      </h2>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {items.map((it, i) => (
          <details key={i} className="group py-2">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
              <span>{it.q}</span>
              <span className="shrink-0 text-lg leading-none text-slate-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="mt-2 text-sm leading-relaxed text-slate-500">
              {it.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
