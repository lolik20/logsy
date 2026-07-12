"use client";

import { useState } from "react";

export function BillingManager({ currentSites }: { currentSites: number }) {
  const [sites, setSites] = useState(Math.max(currentSites, 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sites }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        // Редирект на страницу оплаты Т-Кассы.
        window.location.href = data.url;
        return;
      }
      setError(data.error || "Не удалось перейти к оплате");
      setLoading(false);
    } catch {
      setError("Не удалось перейти к оплате");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md rounded-2xl border-2 border-brand bg-white p-6 dark:bg-slate-900">
      <div className="text-sm font-semibold uppercase tracking-wide text-brand">
        Тариф Pro
      </div>

      <label className="mt-4 block text-sm text-slate-500">
        Количество сайтов
        <input
          type="number"
          min={1}
          max={100}
          value={sites}
          onChange={(e) => setSites(Math.max(1, Number(e.target.value)))}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
        />
      </label>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-3xl font-extrabold">{300 * sites} ₽</span>
        <span className="text-slate-500">/ месяц</span>
      </div>

      <button
        onClick={pay}
        disabled={loading}
        className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? "Переходим к оплате…" : "Перейти к оплате"}
      </button>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-slate-400">
        Оплата картой через Т-Кассу. Чек по 54-ФЗ придёт на вашу почту.
        Подписка активируется автоматически после успешной оплаты.
      </p>
    </div>
  );
}
