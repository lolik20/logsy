"use client";

import { useState } from "react";
import {
  BILLING_PLANS,
  MAX_SESSIONS_PER_DAY,
  MAX_RETENTION_HOURS,
  SESSIONS_STEP,
  RETENTION_STEP,
  clampSessions,
  clampRetention,
  monthlyCustomPriceRub,
  customPriceRub,
  customBasePriceRub,
  isFreeConfig,
  retentionHoursLabel,
  type BillingPeriod,
  type CustomPlan,
  type PricingConfig,
} from "@/lib/pricing";

export function ProjectBillingManager({
  projectId,
  currentSessions,
  currentRetention,
  pricing,
}: {
  projectId: string;
  currentSessions: number;
  currentRetention: number;
  pricing: PricingConfig;
}) {
  const [sessions, setSessions] = useState<number>(
    clampSessions(currentSessions || pricing.freeSessionsPerDay, pricing),
  );
  const [retention, setRetention] = useState<number>(
    clampRetention(currentRetention || pricing.freeRetentionHours, pricing),
  );
  const [period, setPeriod] = useState<BillingPeriod>("1m");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config: CustomPlan = { sessionsPerDay: sessions, retentionHours: retention };
  const plan = BILLING_PLANS.find((p) => p.id === period)!;
  const monthly = monthlyCustomPriceRub(config, pricing);
  const total = customPriceRub(config, plan, pricing);
  const base = customBasePriceRub(config, plan, pricing);
  const hasDiscount = plan.discountPercent > 0 && total < base;
  const free = isFreeConfig(config, pricing) || monthly <= 0;

  const extraSessions = Math.max(0, sessions - pricing.freeSessionsPerDay);
  const extraHours = Math.max(0, retention - pricing.freeRetentionHours);

  async function pay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          projectId,
          sessionsPerDay: sessions,
          retentionHours: retention,
          period,
        }),
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 text-lg font-semibold">Настройте тариф под себя</div>
      <p className="mb-6 text-sm text-slate-500">
        {pricing.freeSessionsPerDay} сессий в сутки и хранение логов{" "}
        {retentionHoursLabel(pricing.freeRetentionHours)} — бесплатно навсегда. Дальше:{" "}
        {pricing.rubPerSessionMonth} ₽/мес за каждую суточную сессию и{" "}
        {pricing.rubPerRetentionHourMonth} ₽/мес за каждый час хранения.
      </p>

      {/* Ползунок: суточные сессии */}
      <Slider
        label="Пользовательских сессий в сутки"
        value={sessions}
        min={pricing.freeSessionsPerDay}
        max={MAX_SESSIONS_PER_DAY}
        step={SESSIONS_STEP}
        onChange={(v) => setSessions(clampSessions(v, pricing))}
        format={(v) => v.toLocaleString("ru-RU")}
        hint={
          extraSessions > 0
            ? `+${extraSessions.toLocaleString("ru-RU")} сверх бесплатных → ${(
                extraSessions * pricing.rubPerSessionMonth
              ).toLocaleString("ru-RU")} ₽/мес`
            : "в пределах бесплатного объёма"
        }
      />

      {/* Ползунок: срок хранения */}
      <Slider
        label="Хранение логов"
        value={retention}
        min={pricing.freeRetentionHours}
        max={MAX_RETENTION_HOURS}
        step={RETENTION_STEP}
        onChange={(v) => setRetention(clampRetention(v, pricing))}
        format={(v) => retentionHoursLabel(v)}
        hint={
          extraHours > 0
            ? `+${extraHours} ч сверх бесплатных → ${(
                extraHours * pricing.rubPerRetentionHourMonth
              ).toLocaleString("ru-RU")} ₽/мес`
            : "в пределах бесплатного объёма"
        }
      />

      {/* Период оплаты */}
      <div className="mt-6">
        <div className="text-sm text-slate-500">Период оплаты</div>
        <div className="mt-2 grid max-w-md grid-cols-3 gap-2">
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
                  {customPriceRub(config, p, pricing).toLocaleString("ru-RU")} ₽
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Итог */}
      <div className="mt-6 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Стоимость в месяц</span>
          <span className="font-semibold text-slate-700 dark:text-slate-200">
            {monthly.toLocaleString("ru-RU")} ₽
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold">{total.toLocaleString("ru-RU")} ₽</span>
          {hasDiscount && (
            <span className="text-slate-400 line-through">
              {base.toLocaleString("ru-RU")} ₽
            </span>
          )}
          <span className="text-slate-500">за {plan.label.toLowerCase()}</span>
        </div>
        {hasDiscount && (
          <div className="mt-1 text-sm text-green-600">
            Выгода {(base - total).toLocaleString("ru-RU")} ₽ ({plan.discountPercent}%)
          </div>
        )}
      </div>

      {free ? (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          🎁 Текущая конфигурация в пределах бесплатного объёма — оплата не нужна.
          Подвиньте ползунки, чтобы поднять лимиты.
        </div>
      ) : (
        <button
          onClick={pay}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading
            ? "Переходим к оплате…"
            : `Оплатить ${total.toLocaleString("ru-RU")} ₽ за ${plan.label.toLowerCase()}`}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-slate-400">
        Оплата картой через Т-Кассу. Чек по 54-ФЗ придёт на вашу почту.
        Оплаченный период добавляется к текущему сроку тарифа проекта.
      </p>
    </div>
  );
}

/** Ползунок с подписью значения и денежной подсказкой. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  hint: string;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
        <span className="text-lg font-bold text-brand">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-brand"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
        <span>{format(min)}</span>
        <span className="text-slate-500">{hint}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
