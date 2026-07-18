"use client";

import { useState } from "react";
import {
  BILLING_PLANS,
  customPriceRub,
  monthlyCustomPriceRub,
  retentionHoursLabel,
  type PricingConfig,
} from "@/lib/pricing";

// Форма настройки кастомной тарификации (только для администратора). Меняет
// бесплатный объём и помесячные ставки; значения сохраняются глобально и сразу
// применяются на лендинге, вкладке «Тариф» проектов и при оплате.
export function PricingSettingsForm({ initial }: { initial: PricingConfig }) {
  const [cfg, setCfg] = useState<PricingConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(field: keyof PricingConfig, value: number) {
    setCfg((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
      } else {
        setCfg(data);
        setSaved(true);
      }
    } catch {
      setError("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  // Пример расчёта для наглядности: 1000 сессий/сутки, 24 часа хранения.
  const example = { sessionsPerDay: 1000, retentionHours: 24 };
  const exampleMonthly = monthlyCustomPriceRub(example, cfg);
  const exampleYear = customPriceRub(example, BILLING_PLANS[2], cfg);

  return (
    <div className="max-w-2xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Бесплатно сессий в сутки"
          hint="Базовая суточная квота сессий без оплаты"
          value={cfg.freeSessionsPerDay}
          min={0}
          onChange={(v) => update("freeSessionsPerDay", v)}
          suffix="сессий"
        />
        <Field
          label="Бесплатное хранение логов"
          hint={`Сейчас: ${retentionHoursLabel(cfg.freeRetentionHours)}`}
          value={cfg.freeRetentionHours}
          min={1}
          onChange={(v) => update("freeRetentionHours", v)}
          suffix="часов"
        />
        <Field
          label="Цена за суточную сессию"
          hint="Доплата в месяц за каждую сессию сверх бесплатной квоты"
          value={cfg.rubPerSessionMonth}
          min={0}
          onChange={(v) => update("rubPerSessionMonth", v)}
          suffix="₽ / мес"
        />
        <Field
          label="Цена за час хранения"
          hint="Доплата в месяц за каждый час хранения сверх бесплатного"
          value={cfg.rubPerRetentionHourMonth}
          min={0}
          onChange={(v) => update("rubPerRetentionHourMonth", v)}
          suffix="₽ / мес"
        />
      </div>

      {/* Пример расчёта */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="font-medium text-slate-700 dark:text-slate-200">
          Пример: {example.sessionsPerDay.toLocaleString("ru-RU")} сессий/сутки,
          хранение {retentionHoursLabel(example.retentionHours)}
        </div>
        <div className="mt-1 text-slate-500">
          {exampleMonthly.toLocaleString("ru-RU")} ₽/мес · за год (−20%){" "}
          {exampleYear.toLocaleString("ru-RU")} ₽
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Сохранено</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <p className="text-xs text-slate-400">
        Изменения применяются сразу: к лендингу, форме тарифа проектов и расчёту
        оплаты. Уже оплаченные периоды не пересчитываются.
      </p>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  min,
  onChange,
  suffix,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</div>
      <div className="mt-1.5 flex items-center rounded-lg border border-slate-200 bg-white focus-within:border-brand dark:border-slate-700 dark:bg-slate-900">
        <input
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(Math.max(min, Math.round(Number(e.target.value) || 0)))}
          className="w-full bg-transparent px-3 py-2 text-sm outline-none"
        />
        <span className="whitespace-nowrap px-3 text-xs text-slate-400">{suffix}</span>
      </div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </label>
  );
}
