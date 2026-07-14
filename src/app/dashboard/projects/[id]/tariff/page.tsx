import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { ProjectBillingManager } from "@/components/ProjectBillingManager";
import { describeProjectBilling, isProjectTrialActive } from "@/lib/subscription";
import { getTier } from "@/lib/pricing";

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
  const trial = isProjectTrialActive(project);
  const tier = getTier(project.tier);
  const tierLabel = tier ? tier.name : trial ? "Пробный период" : "—";

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

      {trial && status.periodEnd && (
        <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          🎁 Идёт пробный период — до <b>{status.periodEnd}</b>. Выберите тариф,
          чтобы сервис продолжил работать после окончания.
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
          value={tier ? tier.sessionsLabel.replace("до ", "") : "1000 (триал)"}
        />
      </div>

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

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
