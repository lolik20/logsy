"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DomainBadge } from "@/components/DomainBadge";

export interface ProjectDomainSettingsProps {
  projectId: string;
  domain: string;
  checkDomain: boolean;
  domainStatus: string;
  domainExpiresAt: string | null;
  domainDaysLeft: number | null;
  domainRegistrar: string | null;
  domainCheckedAt: string | null;
}

export function ProjectDomainSettings(props: ProjectDomainSettingsProps) {
  const router = useRouter();
  const [checkDomain, setCheckDomain] = useState(props.checkDomain);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    setLoading(true);
    // Оптимистично переключаем тумблер.
    setCheckDomain(next);
    const res = await fetch(`/api/projects/${props.projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ checkDomain: next }),
    });
    setLoading(false);
    if (!res.ok) {
      setCheckDomain(!next); // откат
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось сохранить");
      return;
    }
    router.refresh();
  }

  const hasData =
    checkDomain &&
    props.domainStatus !== "OFF" &&
    props.domainStatus !== "PENDING";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Регистрация домена</h2>
            {checkDomain && (
              <DomainBadge
                status={props.domainStatus}
                daysLeft={props.domainDaysLeft}
              />
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Следим за сроком регистрации домена {props.domain} и предупреждаем на
            почту за месяц, за 2 недели, за неделю, за 3 дня и за 1 день до
            окончания.
          </p>
        </div>

        {/* Тумблер включения проверки */}
        <button
          type="button"
          role="switch"
          aria-checked={checkDomain}
          disabled={loading}
          onClick={() => toggle(!checkDomain)}
          className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            checkDomain ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
          }`}
          title={
            checkDomain
              ? "Отключить проверку регистрации домена"
              : "Включить проверку регистрации домена"
          }
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              checkDomain ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {checkDomain && (
        <div className="mt-4">
          {props.domainStatus === "PENDING" && (
            <p className="text-sm text-slate-500">
              Срок регистрации ещё не проверялся — данные появятся после
              ближайшего прогона.
            </p>
          )}
          {props.domainStatus === "ERROR" && (
            <p className="text-sm text-red-600">
              Не удалось получить данные о регистрации при последней проверке.
              Возможно, реестр домена не поддерживает RDAP.
            </p>
          )}
          {hasData && (
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
              <div>
                <div className="text-xs text-slate-500">Действует до</div>
                <div className="mt-0.5 font-medium">
                  {props.domainExpiresAt
                    ? new Date(props.domainExpiresAt).toLocaleDateString(
                        "ru-RU",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        },
                      )
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Осталось дней</div>
                <div className="mt-0.5 font-medium">
                  {props.domainDaysLeft != null ? props.domainDaysLeft : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Регистратор</div>
                <div className="mt-0.5 truncate font-medium">
                  {props.domainRegistrar ?? "—"}
                </div>
              </div>
            </div>
          )}
          {props.domainCheckedAt && props.domainStatus !== "PENDING" && (
            <p className="mt-3 text-xs text-slate-400">
              Проверено:{" "}
              {new Date(props.domainCheckedAt).toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
