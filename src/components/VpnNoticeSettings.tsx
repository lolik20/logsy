"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Блок «Просьба отключить VPN» на вкладке «Подключение». Тумблер включает на сайте проекта
 * автоматическую плашку «Пожалуйста, отключите VPN…». Показывается только посетителям, чей
 * IP определился как не российский: страну считает сервер в /api/logger/config по IP запроса
 * конфига, поэтому на клиенте никаких сторонних сервисов не дёргается.
 */
export function VpnNoticeSettings({
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
      body: JSON.stringify({ vpnNotice: next }),
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
            Автоблок «Отключите VPN»
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Если IP посетителя определился как не российский, вверху страницы появится
            плашка «Пожалуйста, отключите VPN для более быстрой загрузки сайта» с кнопкой
            «ОК» — она закрывает блок до конца визита. Посетителям из России и тем, чью
            страну определить не удалось, блок не показывается.
          </p>
        </div>

        {/* Тумблер включения блока */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={loading}
          onClick={() => toggle(!enabled)}
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
          }`}
          title={enabled ? "Отключить блок" : "Включить блок"}
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
