"use client";

// Форма админ-инструмента «Обход»: поле с адресом сайта + кнопка «Запуск». По сабмиту
// шлёт URL на /api/admin/scan, бот обходит сайт настоящим headless-браузером и возвращает
// отчёт (карта сайта с критическими моментами, ошибки бэкенда, медленные запросы, статика,
// почты и телефоны). Отчёт рендерится компонентом ScanReportView прямо под формой. Прежний
// отчёт при новом запуске не сбрасывается — он остаётся на экране, пока не придёт новый.

import { useState } from "react";
import { ScanReportView, type ScanReport } from "@/components/ScanReportView";

export function SiteScanForm() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [scanId, setScanId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Отчёт намеренно НЕ сбрасываем — прежний остаётся виден, пока не придёт новый.
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось обойти сайт");
        return;
      }
      setReport(data as ScanReport);
      setScanId((data as { scanId?: string }).scanId);
    } catch {
      setError("Не удалось обойти сайт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

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
          disabled={loading}
          className="w-full flex-1 rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-base outline-none focus:border-brand disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "Обходим сайт…" : "Запуск"}
        </button>
      </form>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">
          Бот обходит сайт по внутренним ссылкам и проверяет запросы — это может занять до
          минуты. Прошлый отчёт останется на экране, пока не будет готов новый.
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {report && (
        <div className={`mt-6 ${loading ? "opacity-50" : ""}`}>
          <ScanReportView report={report} scanId={scanId} />
        </div>
      )}
    </div>
  );
}
