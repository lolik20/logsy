"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABEL, URL_MODE_LABEL, type ExceptionKind, type UrlMode } from "@/lib/exceptions";

export type ProjectException = {
  id: string;
  kind: string;
  urlMode: string;
  url: string;
};

/**
 * Блок «Исключения проекта» на странице логов. Показывает активные правила игнора и
 * позволяет их снять (DELETE /api/logger/exceptions) — тогда такие события снова
 * начнут сохраняться. Правила действуют на весь проект, а не на отдельную сессию.
 */
export function ProjectExceptions({ exceptions }: { exceptions: ProjectException[] }) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);

  if (exceptions.length === 0) return null;

  async function remove(id: string) {
    setRemovingId(id);
    const res = await fetch("/api/logger/exceptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRemovingId(null);
    if (res.ok) {
      router.refresh();
    } else {
      alert("Не удалось снять правило");
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-slate-600 dark:text-slate-300">
          Исключения ({exceptions.length})
        </summary>
        <p className="mt-1 text-xs text-slate-400">
          События, подходящие под правило, не сохраняются во всём сайте.
          «Вернуть» — снова начать их записывать.
        </p>
        <ul className="mt-3 space-y-2">
          {exceptions.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-0">
                <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800">
                  {KIND_LABEL[e.kind as ExceptionKind] ?? e.kind}
                </span>
                <span className="mr-1 text-xs text-slate-400">
                  URL {URL_MODE_LABEL[e.urlMode as UrlMode] ?? e.urlMode}
                </span>
                <span className="break-all font-mono text-xs text-slate-600 dark:text-slate-300">
                  {e.url}
                </span>
              </div>
              <button
                onClick={() => remove(e.id)}
                disabled={removingId === e.id}
                className="shrink-0 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:border-brand hover:text-brand disabled:opacity-60 dark:border-slate-700"
              >
                Вернуть
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
