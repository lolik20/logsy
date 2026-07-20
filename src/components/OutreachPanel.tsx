"use client";

// Панель рассылки по найденным при обходе почтам. Показывает найденные адреса и статус
// рассылки (отправлено / открыто / отписался), и по кнопке шлёт письмо со «скриншотом»
// отчёта на все ещё не охваченные адреса. Работает только когда известен id обхода (scanId).

import { useCallback, useEffect, useState } from "react";

interface OutreachItem {
  toEmail: string;
  status: "SENT" | "FAILED" | "UNSUBSCRIBED";
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

interface SendResult {
  sent: number;
  failed: number;
  skipped: number;
  message?: string;
  screenshot?: boolean;
}

export function OutreachPanel({ scanId, emails }: { scanId: string; emails: string[] }) {
  const [items, setItems] = useState<OutreachItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/scan/${scanId}/outreach`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.items)) setItems(data.items as OutreachItem[]);
    } catch {
      /* статус необязателен */
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    setSending(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/scan/${scanId}/outreach`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось отправить письма");
        return;
      }
      setResult(data as SendResult);
      await load();
    } catch {
      setError("Не удалось отправить письма. Попробуйте ещё раз.");
    } finally {
      setSending(false);
    }
  }

  const byEmail = new Map(items.map((i) => [i.toEmail, i]));
  const pending = emails.filter((e) => !byEmail.has(e.toLowerCase()));
  const sentCount = items.filter((i) => i.status === "SENT").length;
  const openedCount = items.filter((i) => i.openCount > 0).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-slate-500">
          {sentCount > 0 ? (
            <>
              Отправлено: <b>{sentCount}</b> · открыли: <b className="text-brand">{openedCount}</b>
            </>
          ) : (
            "Письмо со «скриншотом» отчёта и призывом подключить Logsy."
          )}
        </div>
        <button
          type="button"
          onClick={send}
          disabled={sending || pending.length === 0}
          className="shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50"
        >
          {sending
            ? "Отправляем…"
            : pending.length === 0
              ? "Все охвачены"
              : sentCount > 0
                ? `Отправить ещё (${pending.length})`
                : `Разослать письмо (${pending.length})`}
        </button>
      </div>

      {result && (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          Отправлено: {result.sent}
          {result.failed ? `, с ошибкой: ${result.failed}` : ""}
          {result.skipped ? `, пропущено: ${result.skipped}` : ""}.
          {result.screenshot === false && " Скриншот отчёта не удалось приложить (нет браузера)."}
          {result.message ? ` ${result.message}` : ""}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {emails.map((m) => {
          const rec = byEmail.get(m.toLowerCase());
          return (
            <span
              key={m}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <a href={`mailto:${m}`} className="font-medium text-brand hover:underline">
                {m}
              </a>
              {rec?.unsubscribedAt ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800">
                  отписался
                </span>
              ) : rec?.status === "FAILED" ? (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
                  ошибка
                </span>
              ) : rec && rec.openCount > 0 ? (
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand dark:bg-brand/15">
                  открыто{rec.openCount > 1 ? ` ×${rec.openCount}` : ""}
                </span>
              ) : rec ? (
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  отправлено
                </span>
              ) : loading ? null : (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:bg-slate-800">
                  не отправлено
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
