"use client";

import { useState } from "react";
import {
  BILLING_PLANS,
  TIERS,
  tierPriceRub,
  tierBasePriceRub,
  getTier,
  type BillingPeriod,
  type TierId,
} from "@/lib/pricing";

export function ProjectBillingManager({
  projectId,
  currentTier,
}: {
  projectId: string;
  currentTier: string | null;
}) {
  const [tierId, setTierId] = useState<TierId>(
    (currentTier as TierId) || "T300",
  );
  const [period, setPeriod] = useState<BillingPeriod>("1m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = getTier(tierId)!;
  const plan = BILLING_PLANS.find((p) => p.id === period)!;
  const total = tierPriceRub(tier, plan);
  const base = tierBasePriceRub(tier, plan);
  const hasDiscount = plan.discountPercent > 0;

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ projectId, tier: tierId, period }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
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
    <div>
      {/* Выбор тарифа */}
      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => {
          const selected = t.id === tierId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierId(t.id)}
              className={`rounded-2xl border-2 p-5 text-left transition ${
                selected
                  ? "border-brand bg-brand/5"
                  : "border-slate-200 hover:border-brand/50 dark:border-slate-700"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand">
                  {t.name}
                </span>
                {currentTier === t.id && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                    текущий
                  </span>
                )}
              </div>
              <div className="mt-2 text-2xl font-extrabold">
                {t.monthlyRub} ₽
                <span className="text-sm font-normal text-slate-500">/мес</span>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="text-brand">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Период оплаты */}
      <div className="mt-6 max-w-md">
        <div className="text-sm text-slate-500">Период оплаты</div>
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
                  {tierPriceRub(tier, p)} ₽
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
          Оплаченный период добавляется к текущему сроку тарифа проекта.
        </p>
      </div>
    </div>
  );
}
