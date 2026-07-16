import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { ProjectBillingManager } from "@/components/ProjectBillingManager";
import { describeProjectBilling, isProjectFree } from "@/lib/subscription";
import { getTier, FREE_TIER } from "@/lib/pricing";
import { getSessionUsage } from "@/lib/logging";

export const dynamic = "force-dynamic";

export default async function ProjectTariffPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { paid?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();
  const paid = searchParams?.paid;

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const isowner = project.userId === userId;
  const status = describeProjectBilling(project, admin);
  const free = isProjectFree(project);
  const tier = getTier(project.tier);
  const tierLabel = tier ? tier.name : free ? FREE_TIER.name : "—";

  // Использование суточной квоты сессий (сегодня, UTC) — для прогресс-бара ниже.
  const usage = await getSessionUsage(project.id, project.tier);

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="tariff"
      />

      {paid === "1" && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          ✅ Оплата прошла. Тариф активируется автоматически в течение пары минут
          после подтверждения платежа Т-Кассой — обновите страницу, если статус
          ещё не изменился.
        </div>
      )}
      {paid === "0" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Оплата не завершена. Вы можете попробовать снова.
        </div>
      )}

      {free && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          🎁 Проект на бесплатном тарифе — {FREE_TIER.sessionsLabel}, хранение
          логов 12 часов. Выберите платный тариф, чтобы поднять лимиты и увеличить
          срок хранения.
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card
          label="Статус"
          value={status.showPeriodEnd ? `${status.label} · до ${status.periodEnd}` : status.label}
        />
        <Card label="Тариф" value={tierLabel} />
        <Card
          label="Сессий в сутки"
          value={(tier ?? FREE_TIER).sessionsLabel.replace("до ", "")}
        />
      </div>

      <SessionUsageBar
        used={usage.used}
        quota={usage.quota}
        ratio={usage.ratio}
        overLimit={usage.overLimit}
      />

      {admin ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          У вас роль администратора — безлимитный доступ ко всем проектам. Оплата
          не требуется.
        </div>
      ) : isowner ? (
        <ProjectBillingManager projectId={project.id} currentTier={project.tier} />
      ) : null}
    </div>
  );
}

/**
 * Прогресс-бар использования суточной квоты сессий: сколько сессий принято сегодня
 * из лимита тарифа. При превышении лимита бар и подпись становятся красными.
 */
function SessionUsageBar({
  used,
  quota,
  ratio,
  overLimit,
}: {
  used: number;
  quota: number;
  ratio: number;
  overLimit: boolean;
}) {
  const percent = Math.round(ratio * 100);
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
          Сессии за сегодня
        </div>
        <div
          className={`text-sm font-semibold ${
            overLimit ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {used.toLocaleString("ru-RU")} из {quota.toLocaleString("ru-RU")}
          <span className="ml-1 font-normal text-slate-400">({percent}%)</span>
        </div>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={quota}
      >
        <div
          className={`h-full rounded-full transition-all ${
            overLimit
              ? "bg-red-500"
              : ratio >= 0.9
                ? "bg-amber-500"
                : "bg-brand"
          }`}
          style={{ width: `${Math.max(ratio * 100, used > 0 ? 2 : 0)}%` }}
        />
      </div>
      {overLimit && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          Суточный лимит сессий исчерпан — новые сессии сегодня не принимаются.
          Повысьте тариф, чтобы увеличить лимит.
        </p>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
