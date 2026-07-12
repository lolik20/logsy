"use client";

import { useState } from "react";
import {
  BILLING_PLANS,
  basePriceRub,
  totalPriceRub,
  type BillingPeriod,
} from "@/lib/pricing";

export function BillingManager({ currentSites }: { currentSites: number }) {
  const [sites, setSites] = useState(Math.max(currentSites, 1));
  const [period, setPeriod] = useState<BillingPeriod>("1m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = BILLING_PLANS.find((p) => p.id === period)!;
  const total = totalPriceRub(plan, sites);
  const base = basePriceRub(plan, sites);
  const hasDiscount = plan.discountPercent > 0;

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sites, period }),
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

      <div className="mt-4 text-sm text-slate-500">Период оплаты</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {BILLING_PLANS.map((p) => {
          const selected = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`relative rounded-xl border-2 px-2 py-3 text-center transition ${
                selected
                  ? "border-brand bg-brand/5"
                  : "border-slate-200 hover:border-brand/50 dark:border-slate-700"
              }`}
            >
              {p.discountPercent > 0 && (
                <span className="absolute -top-2 right-1 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  −{p.discountPercent}%
                </span>
              )}
              <div className="text-sm font-semibold">{p.label}</div>
              <div className="mt-1 text-xs text-slate-500">
                {totalPriceRub(p, sites)} ₽
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-baseline gap-2">
        <span className="text-3xl font-extrabold">{total} ₽</span>
        {hasDiscount && (
          <span className="text-slate-400 line-through">{base} ₽</span>
        )}
        <span className="text-slate-500">за {plan.label.toLowerCase()}</span>
      </div>
      {hasDiscount && (
        <div className="mt-1 text-sm text-green-600">
          Выгода {base - total} ₽ ({plan.discountPercent}%)
        </div>
      )}

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
        Оплаченный период добавляется к текущему сроку подписки.
      </p>
    </div>
  );
}
