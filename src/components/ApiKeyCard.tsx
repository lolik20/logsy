"use client";

import { useState } from "react";

/**
 * Карточка ключа публичного API проекта на вкладке «API». Ключ выпускается на сервере
 * автоматически (см. ensureProjectApiKey) и приходит сюда готовым: пользователю остаётся
 * скопировать его или перевыпустить. По умолчанию ключ скрыт — чтобы его нельзя было
 * подсмотреть через плечо или случайно засветить на демонстрации экрана.
 */
export function ApiKeyCard({
  projectId,
  apiKey: initialKey,
}: {
  projectId: string;
  apiKey: string;
}) {
  const [apiKey, setApiKey] = useState(initialKey);
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Маска: показываем префикс и последние 4 символа, середину прячем.
  const masked = apiKey.slice(0, 3) + "•".repeat(24) + apiKey.slice(-4);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(apiKey);
      } else {
        const ta = document.createElement("textarea");
        ta.value = apiKey;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер недоступен — тихо игнорируем */
    }
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Перевыпустить ключ API? Текущий ключ сразу перестанет работать — все интеграции придётся перевести на новый.",
      )
    )
      return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/api-key`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.apiKey) {
        setError(data.error || "Не удалось перевыпустить ключ");
        setLoading(false);
        return;
      }
      setApiKey(data.apiKey);
      setVisible(true); // новый ключ сразу показываем — его нужно скопировать
      setLoading(false);
    } catch {
      setError("Не удалось перевыпустить ключ");
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
        Ключ API сайта
      </h2>
      <p className="mt-2 text-sm text-slate-500">
        Этим ключом подписываются запросы к методам ниже — по нему сервер определяет
        сайт. Ключ даёт доступ ко всем логам сайта: держите его на сервере и не
        публикуйте в коде страниц и в браузере.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {visible ? apiKey : masked}
        </code>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
        >
          {visible ? "Скрыть" : "Показать"}
        </button>
        <button
          type="button"
          onClick={copy}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            copied
              ? "border-emerald-400 text-emerald-600"
              : "border-slate-300 text-slate-600 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
          }`}
        >
          {copied ? "Скопировано" : "Скопировать"}
        </button>
        <button
          type="button"
          onClick={regenerate}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900/50 dark:hover:bg-red-950/40"
        >
          {loading ? "Выпускаем…" : "Перевыпустить"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <p className="mt-3 text-xs text-slate-400">
        Перевыпуск нужен, если ключ мог утечь: старый ключ отзывается мгновенно, и
        запросы с ним начнут возвращать <span className="font-mono">401</span>.
      </p>
    </div>
  );
}
