"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Кнопка запуска краулера карты страниц. Бот обходит домен проекта по внутренним
// ссылкам и наполняет карту (ProjectPage). Обход синхронный (до ~25с) — показываем
// индикатор и обновляем страницу по завершении.
export function CrawlButton({
  projectId,
  crawledCount,
  lastCrawledAt,
}: {
  projectId: string;
  crawledCount: number;
  lastCrawledAt: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function crawl() {
    setLoading(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/crawl`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось обойти сайт");
        setLoading(false);
        return;
      }
      setNote(`Найдено страниц: ${data.found ?? 0}`);
      router.refresh();
      setLoading(false);
    } catch {
      setError("Не удалось обойти сайт");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={crawl}
        disabled={loading}
        className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-60"
      >
        {loading ? "Обход сайта…" : crawledCount > 0 ? "Пересобрать карту" : "Собрать карту"}
      </button>
      {crawledCount > 0 && lastCrawledAt && !error && !note && (
        <span className="text-xs text-slate-400">
          Страниц в карте: {crawledCount} · обновлено{" "}
          {new Date(lastCrawledAt).toLocaleString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
          })}
        </span>
      )}
      {note && <span className="text-xs text-emerald-600">{note}</span>}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
