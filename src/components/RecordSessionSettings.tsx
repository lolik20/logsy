"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Блок «Запись экрана сессий» на вкладке «Подключение». Тумблер включает на сайте проекта
 * запись пользовательских сессий: клиентский SDK подгружает self-hosted рекордер (rrweb) и
 * стримит DOM-снимки на сервер. Запись затем воспроизводится как видео на странице сессии.
 * Значения полей ввода маскируются на клиенте до отправки (приватность).
 */
export function RecordSessionSettings({
  projectId,
  enabled: initialEnabled,
}: {
  projectId: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setLoading(true);
    // Оптимистично переключаем тумблер.
    setEnabled(next);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recordSession: next }),
    });
    setLoading(false);
    if (!res.ok) {
      setEnabled(!next); // откат
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось сохранить");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Запись экрана сессий
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            SDK запишет действия посетителя (клики, ввод, прокрутку, навигацию) и
            сохранит воспроизводимую запись — её можно посмотреть как видео на странице
            сессии. Значения полей ввода и пароли маскируются, элементы с атрибутом{" "}
            <code className="font-mono">data-logsy-mask</code> скрываются полностью.
            Запись объёмна — включайте, когда нужно разобрать поведение пользователей.
          </p>
        </div>

        {/* Тумблер включения записи */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={() => toggle(!enabled)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
          }`}
          title={enabled ? "Отключить запись" : "Включить запись"}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
