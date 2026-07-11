"use client";

// Error boundary для сегментов приложения. Показывает реальную ошибку вместо
// сообщения App Router «missing required error components».
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Logsy] Ошибка страницы:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
        <p className="mt-2 text-sm text-slate-500">
          При загрузке страницы произошла ошибка. Попробуйте ещё раз.
        </p>
        {error.digest && (
          <p className="mt-2 font-mono text-xs text-slate-400">
            Код: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Повторить
          </button>
          <a
            href="/"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
          >
            На главную
          </a>
        </div>
      </div>
    </main>
  );
}
