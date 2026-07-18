"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Кнопка очистки всех логов проекта. Удаляет сессии и события (после подтверждения).
export function ClearLogsButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    if (!window.confirm("Удалить все логи сайта? Действие необратимо.")) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/logger/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось очистить логи");
        setLoading(false);
        return;
      }
      router.refresh();
      setLoading(false);
    } catch {
      setError("Не удалось очистить логи");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={clear}
        disabled={loading}
        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:hover:bg-red-950/40"
      >
        {loading ? "Очищаем…" : "Очистить логи"}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </div>
  );
}
