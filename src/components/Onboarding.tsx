"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type OnboardingStep = {
  // Стабильный ключ шага (для отслеживания и разметки).
  key: string;
  title: string;
  description: string;
  done: boolean;
  // Куда ведёт кнопка действия, если шаг ещё не выполнен. Для шага «создать проект»
  // действие внутри самой страницы — тогда href не задаётся.
  href?: string;
  actionLabel?: string;
};

const STORAGE_KEY = "logsy.onboarding.hidden";

// Приветственный чек-лист для новых пользователей. Показывает первые шаги
// настройки мониторинга и подсвечивает уже выполненные. Данные о выполнении
// шагов приходят с сервера (см. dashboard/page.tsx). Пользователь может скрыть
// панель — выбор запоминается в localStorage.
export function Onboarding({ steps }: { steps: OnboardingStep[] }) {
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    setHidden(
      typeof window !== "undefined" &&
        window.localStorage.getItem(STORAGE_KEY) === "1",
    );
  }, []);

  // До гидрации ничего не рендерим, чтобы не мигало.
  if (hidden === null || hidden) return null;

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  function hide() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setHidden(true);
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-brand/30 bg-brand/5 p-5 dark:border-brand/40 dark:bg-brand/10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">
            {allDone ? "Всё готово! 🎉" : "Добро пожаловать в Logsy"}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {allDone
              ? "Мониторинг настроен. Панель можно скрыть."
              : "Пара шагов — и мы начнём следить за доступностью вашего сайта."}
          </p>
        </div>
        <button
          onClick={hide}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white/60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60"
        >
          Скрыть
        </button>
      </div>

      {/* Прогресс */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Прогресс</span>
          <span>
            {doneCount} из {steps.length}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${(doneCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="mt-4 space-y-3">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                step.done
                  ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {step.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`font-medium ${
                  step.done ? "text-slate-400 line-through" : ""
                }`}
              >
                {step.title}
              </div>
              <p className="mt-0.5 text-sm text-slate-500">{step.description}</p>
            </div>
            {!step.done && step.href && (
              <Link
                href={step.href}
                className="shrink-0 self-center rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark"
              >
                {step.actionLabel ?? "Перейти"}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
