"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Управление тарифом проекта администратором (вкладка «Тариф» проекта).
 * Позволяет выдать проекту активный тариф с датой окончания («до …»),
 * изменить срок или снять его. Дёргает /api/admin/projects/[id]/tariff и
 * обновляет страницу.
 */
export function AdminProjectTariff({
  projectId,
  isPaid,
  currentPeriodEnd,
}: {
  projectId: string;
  /** Активен ли сейчас платный тариф проекта (для кнопки «Снять»). */
  isPaid: boolean;
  /** Текущая дата окончания тарифа (ISO), если есть. */
  currentPeriodEnd: string | null;
}) {
  const router = useRouter();
  // Значение поля даты в формате YYYY-MM-DD.
  const [until, setUntil] = useState<string>(() => defaultUntil(currentPeriodEnd));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    if (!until) {
      setError("Укажите дату");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tariff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ until }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось выдать тариф");
        setLoading(false);
        return;
      }
      router.refresh();
      setLoading(false);
    } catch {
      setError("Не удалось выдать тариф");
      setLoading(false);
    }
  }

  async function revoke() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/tariff`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось снять тариф");
        setLoading(false);
        return;
      }
      router.refresh();
      setLoading(false);
    } catch {
      setError("Не удалось снять тариф");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-1 text-lg font-semibold">Тариф проекта (админ)</div>
      <p className="mb-4 text-sm text-slate-500">
        Выдайте проекту активный тариф до выбранной даты — мониторинг и
        логирование будут работать до конца указанного дня. «Снять» возвращает
        проект на бесплатный тариф.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm text-slate-600 dark:text-slate-300">
          Активен до
        </label>
        <input
          type="date"
          value={until}
          min={today()}
          onChange={(e) => setUntil(e.target.value)}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={grant}
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isPaid ? "Изменить срок" : "Выдать тариф"}
        </button>
        {isPaid && (
          <button
            type="button"
            onClick={revoke}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Снять
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

/** Сегодняшняя дата в формате YYYY-MM-DD (для min поля даты). */
function today(): string {
  return toDateInput(new Date());
}

/** Значение по умолчанию: текущий срок тарифа либо месяц вперёд. */
function defaultUntil(currentPeriodEnd: string | null): string {
  if (currentPeriodEnd) {
    const d = new Date(currentPeriodEnd);
    if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now()) return toDateInput(d);
  }
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return toDateInput(d);
}

function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
