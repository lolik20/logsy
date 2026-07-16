"use client";

import Link from "next/link";
import { useState } from "react";

interface SpeedResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
  sizeBytes: number;
  redirected: boolean;
  finalUrl: string;
}

/** Оценка скорости по полному времени загрузки. */
function grade(totalMs: number): { label: string; cls: string; bar: string; w: string } {
  if (totalMs < 800)
    return { label: "Быстро", cls: "text-emerald-600", bar: "bg-emerald-500", w: "25%" };
  if (totalMs < 2000)
    return { label: "Хорошо", cls: "text-emerald-600", bar: "bg-emerald-500", w: "50%" };
  if (totalMs < 4000)
    return { label: "Средне", cls: "text-amber-600", bar: "bg-amber-500", w: "75%" };
  return { label: "Медленно", cls: "text-red-600", bar: "bg-red-500", w: "100%" };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} МБ`;
}

export function SpeedTestForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/speed-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось проверить сайт");
        return;
      }
      setResult(data as SpeedResult);
    } catch {
      setError("Не удалось проверить сайт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const g = result ? grade(result.totalMs) : null;

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          required
          placeholder="example.ru"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full flex-1 rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-base outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-900/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "Проверяем…" : "Проверить скорость"}
        </button>
      </form>

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && g && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
          {/* Заголовок карточки результата */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/70">
            <span className="min-w-0 truncate font-mono text-sm text-slate-500">
              {result.finalUrl}
            </span>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                result.statusCode >= 200 && result.statusCode < 400
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              }`}
            >
              HTTP {result.statusCode}
            </span>
          </div>

          {/* Итоговая оценка */}
          <div className="px-5 pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500">Полное время загрузки</span>
              <span className={`text-2xl font-extrabold ${g.cls}`}>{g.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">{formatMs(result.totalMs)}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className={`block h-full rounded-full ${g.bar}`} style={{ width: g.w }} />
            </div>
          </div>

          {/* Метрики */}
          <div className="grid grid-cols-3 gap-px bg-slate-200/70 p-5 dark:bg-slate-700/50">
            {[
              { label: "Время до первого байта", value: formatMs(result.ttfbMs) },
              { label: "Полная загрузка", value: formatMs(result.totalMs) },
              { label: "Размер ответа", value: formatBytes(result.sizeBytes) },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white px-3 py-3 text-center dark:bg-slate-900"
              >
                <div className="text-lg font-bold">{m.value}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-500">
                  {m.label}
                </div>
              </div>
            ))}
          </div>

          {result.redirected && (
            <p className="px-5 pb-4 text-xs text-slate-400">
              Запрос прошёл через переадресацию до конечного адреса.
            </p>
          )}
        </div>
      )}

      {/* CTA — подробный отчёт */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-indigo-500 p-[1.5px] shadow-card">
        <div className="rounded-[calc(1rem-1.5px)] bg-white/85 px-6 py-6 text-center backdrop-blur-xl dark:bg-slate-900/85 sm:px-8">
          <h3 className="text-xl font-bold sm:text-2xl">
            Нужен подробный отчёт о загрузке сайта?
          </h3>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
            Logsy обойдёт весь сайт, построит карту загрузки страниц, найдёт медленные
            запросы и тяжёлые файлы — по каждому разделу. Бесплатно.
          </p>
          <Link
            href="/register"
            className="mt-5 inline-block rounded-xl bg-gradient-to-r from-brand to-indigo-500 px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
          >
            Получить подробный отчёт о загрузке сайта бесплатно
          </Link>
        </div>
      </div>
    </div>
  );
}
