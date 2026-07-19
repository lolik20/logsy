"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Управление тарифом пользователя администратором (вкладка «Пользователи»).
 * Позволяет выдать пользователю активный тариф с датой окончания («до …») или
 * снять его. Дёргает /api/admin/users/[id]/tariff и обновляет страницу.
 */
export function AdminUserTariff({
  userId,
  isPaid,
  currentPeriodEnd,
}: {
  userId: string;
  /** Активен ли сейчас платный тариф (для показа кнопки «Снять»). */
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
      const res = await fetch(`/api/admin/users/${userId}/tariff`, {
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
      const res = await fetch(`/api/admin/users/${userId}/tariff`, {
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
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={until}
          min={today()}
          onChange={(e) => setUntil(e.target.value)}
          disabled={loading}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="button"
          onClick={grant}
          disabled={loading}
          className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {isPaid ? "Изменить" : "Выдать"}
        </button>
        {isPaid && (
          <button
            type="button"
            onClick={revoke}
            disabled={loading}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Снять
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
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
