"use client";

// Калькулятор кастомного тарифа на лендинге: те же ползунки и формула, что в панели
// (ProjectBillingManager), но без оплаты — итог ведёт на регистрацию. Цена показывается
// финальная: скидка за период уже вычтена, по умолчанию выбран год (−20%).

import Link from "next/link";
import { useState } from "react";
import {
  BILLING_PLANS,
  FREE_SESSIONS_PER_DAY,
  FREE_RETENTION_HOURS,
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
} from "@/lib/pricing";

const fmt = (n: number) => n.toLocaleString("ru-RU");

// Оценка потерь бизнеса от незамеченного сбоя: доля посетителей, которые стали бы
// клиентами (типичная конверсия сайта в заявку ~2%).
const LEAD_CONVERSION = 0.02;

export function PricingCalculator() {
  const [sessions, setSessions] = useState(1000);
  const [retention, setRetention] = useState(72);
  const [avgCheck, setAvgCheck] = useState(3000);
  const [period, setPeriod] = useState<BillingPeriod>("12m");

  const config: CustomPlan = { sessionsPerDay: sessions, retentionHours: retention };
  const plan = BILLING_PLANS.find((p) => p.id === period)!;
  const monthly = monthlyCustomPriceRub(config);
  const total = customPriceRub(config, plan);
  const base = customBasePriceRub(config, plan);
  const hasDiscount = plan.discountPercent > 0 && total < base;
  const free = isFreeConfig(config) || monthly <= 0;

  // Сутки незамеченного сбоя: сколько лидов и денег теряет бизнес при вашем трафике.
  const lostLeadsPerDay = Math.max(1, Math.round(sessions * LEAD_CONVERSION));
  const lostRevenuePerDay = lostLeadsPerDay * avgCheck;

  return (
    <div className="flex h-full flex-col">
      {/* Ползунок: суточные сессии */}
      <Slider
        label="Пользователей в сутки"
        value={sessions}
        min={FREE_SESSIONS_PER_DAY}
        max={MAX_SESSIONS_PER_DAY}
        step={SESSIONS_STEP}
        onChange={(v) => setSessions(clampSessions(v))}
        format={fmt}
      />

      {/* Ползунок: срок хранения логов */}
      <Slider
        label="Хранение логов"
        value={retention}
        min={FREE_RETENTION_HOURS}
        max={MAX_RETENTION_HOURS}
        step={RETENTION_STEP}
        onChange={(v) => setRetention(clampRetention(v))}
        format={retentionHoursLabel}
      />

      {/* Ползунок: средний чек — на цену тарифа не влияет, нужен для оценки потерь */}
      <Slider
        label="Средний чек клиента"
        value={avgCheck}
        min={500}
        max={50000}
        step={500}
        onChange={(v) => setAvgCheck(v)}
        format={(v) => `${fmt(v)} ₽`}
      />

      {/* Период оплаты — сегментный переключатель в стиле iOS */}
      <div className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-slate-900/5 p-1 dark:bg-white/10">
        {BILLING_PLANS.map((p) => {
          const selected = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={selected}
              className={`rounded-full px-2 py-2 text-xs font-semibold transition-colors ${
                selected
                  ? "bg-white text-slate-900 shadow-card dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {p.label}
              {p.discountPercent > 0 && (
                <span className={`ml-1 ${selected ? "text-green-600" : "text-green-600/70"}`}>
                  −{p.discountPercent}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Итог: финальная цена за период — скидка уже вычтена */}
      <div className="mt-5 flex-1">
        {free ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">0 ₽</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Такой объём входит в бесплатный тариф — оплата не нужна.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-4xl font-extrabold">{fmt(total)} ₽</span>
              {hasDiscount && (
                <span className="text-lg text-slate-400 line-through">{fmt(base)} ₽</span>
              )}
              <span className="text-slate-500">за {plan.label.toLowerCase()}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {hasDiscount ? (
                <>
                  Это {fmt(Math.round(total / plan.months))} ₽/мес — цена финальная,
                  скидка {plan.discountPercent}% уже вычтена.
                </>
              ) : (
                <>{fmt(monthly)} ₽/мес. Год со скидкой −20% выгоднее.</>
              )}
            </p>
          </>
        )}

        {/* Экономия для бизнеса: во что обходится день незамеченного сбоя */}
        <div className="mt-3 rounded-2xl bg-green-50 p-3.5 dark:bg-green-950/40">
          <div className="text-sm font-semibold text-green-700 dark:text-green-400">
            Экономия для бизнеса — до {fmt(lostRevenuePerDay)} ₽ в сутки
          </div>
          <p className="mt-1 text-xs text-green-700/80 dark:text-green-400/80">
            День незамеченного сбоя при вашем трафике — это ~{fmt(lostLeadsPerDay)}{" "}
            потерянных лидов × средний чек {fmt(avgCheck)} ₽ (конверсия в заявку 2%).
            Мониторинг сообщает о сбое за минуты.
          </p>
        </div>
      </div>

      <Link
        href="/register"
        className="mt-6 block rounded-full bg-gradient-to-r from-brand to-indigo-500 px-6 py-3 text-center font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
      >
        {free ? "Начать бесплатно" : `Начать за ${fmt(total)} ₽`}
      </Link>
    </div>
  );
}

/** Ползунок со значением справа и границами диапазона под дорожкой. */
function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="mt-4 first:mt-0">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
        <span className="text-base font-bold text-brand">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="range-slider mt-2 w-full bg-slate-900/10 dark:bg-white/15"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-400">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}
