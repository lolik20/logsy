import Link from "next/link";
import type { DemoFeature } from "@/lib/demo";

// Пояснительная плашка к функции demo-сайта: заголовок + текст с описанием назначения.
// Выводится рядом с каждым блоком demo-страниц, чтобы новый пользователь понимал, что делает
// каждая функция панели, ещё до подключения своего сайта.
export function DemoNote({ feature }: { feature: DemoFeature }) {
  return (
    <div className="mb-3 flex gap-2 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2 text-sm text-slate-600 dark:border-brand/40 dark:bg-brand/10 dark:text-slate-300">
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
      <div>
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {feature.title}.
        </span>{" "}
        {feature.text}
      </div>
    </div>
  );
}

// Верхняя плашка demo-режима: объясняет, что это демонстрация на тестовых данных, и зовёт
// подключить собственный сайт.
export function DemoBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-brand/30 bg-brand/5 p-4 dark:border-brand/40 dark:bg-brand/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
              DEMO
            </span>
            <h2 className="text-lg font-bold">Демонстрационный сайт «Demo Shop»</h2>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Так выглядит панель на подключённом сайте: мониторинг, ошибки, медленные
            запросы и запись экрана — на тестовых данных. Рядом с каждым блоком —
            пояснение к функции.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Подключить свой сайт
        </Link>
      </div>
    </div>
  );
}
