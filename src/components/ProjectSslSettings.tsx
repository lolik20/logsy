"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SslBadge } from "@/components/SslBadge";

export interface ProjectSslSettingsProps {
  projectId: string;
  domain: string;
  checkSsl: boolean;
  sslStatus: string;
  sslExpiresAt: string | null;
  sslDaysLeft: number | null;
  sslIssuer: string | null;
  sslCheckedAt: string | null;
}

export function ProjectSslSettings(props: ProjectSslSettingsProps) {
  const router = useRouter();
  const [checkSsl, setCheckSsl] = useState(props.checkSsl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setLoading(true);
    // Оптимистично переключаем тумблер.
    setCheckSsl(next);
    const res = await fetch(`/api/projects/${props.projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkSsl: next }),
    });
    setLoading(false);
    if (!res.ok) {
      setCheckSsl(!next); // откат
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось сохранить");
      return;
    }
    router.refresh();
  }

  const hasData =
    checkSsl && props.sslStatus !== "OFF" && props.sslStatus !== "PENDING";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">SSL-сертификат</h2>
            {checkSsl && (
              <SslBadge status={props.sslStatus} daysLeft={props.sslDaysLeft} />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Следим за сроком сертификата домена {props.domain} и предупреждаем на
            почту за неделю, за 3 дня, за 1 день и за 1 час до окончания.
          </p>
        </div>

        {/* Тумблер включения проверки */}
        <button
          type="button"
          role="switch"
          aria-checked={checkSsl}
          disabled={loading}
          onClick={() => toggle(!checkSsl)}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            checkSsl ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
          }`}
          title={checkSsl ? "Отключить проверку SSL" : "Включить проверку SSL"}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              checkSsl ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {checkSsl && (
        <div className="mt-4">
          {props.sslStatus === "PENDING" && (
            <p className="text-sm text-slate-500">
              Сертификат ещё не проверялся — данные появятся после ближайшего
              прогона.
            </p>
          )}
          {props.sslStatus === "ERROR" && (
            <p className="text-sm text-red-600">
              Не удалось получить сертификат при последней проверке. Проверьте,
              что домен доступен по https://.
            </p>
          )}
          {hasData && (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Действует до</div>
                <div className="mt-0.5 font-medium">
                  {props.sslExpiresAt
                    ? new Date(props.sslExpiresAt).toLocaleDateString("ru-RU", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Осталось дней</div>
                <div className="mt-0.5 font-medium">
                  {props.sslDaysLeft != null ? props.sslDaysLeft : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Издатель</div>
                <div className="mt-0.5 truncate font-medium">
                  {props.sslIssuer ?? "—"}
                </div>
              </div>
            </div>
          )}
          {props.sslCheckedAt && props.sslStatus !== "PENDING" && (
            <p className="mt-3 text-xs text-slate-400">
              Проверено:{" "}
              {new Date(props.sslCheckedAt).toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
