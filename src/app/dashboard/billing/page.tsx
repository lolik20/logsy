import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { BillingManager } from "@/components/BillingManager";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const userId = (await getUserId())!;
  const [sub, projectCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
  ]);

  const sitesLimit = sub?.sitesLimit ?? 1;
  const active = sub?.status === "active";

  return (
    <div>
      <h1 className="text-2xl font-bold">Тарифы и подписка</h1>
      <p className="mt-1 text-sm text-slate-500">Тариф Pro — 300 ₽ за один сайт в месяц.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Статус" value={active ? "Активна" : "Не активна"} />
        <Card label="Лимит сайтов" value={`${sitesLimit}`} />
        <Card label="Используется" value={`${projectCount} из ${sitesLimit}`} />
      </div>

      {sub?.currentPeriodEnd && active && (
        <p className="mt-3 text-sm text-slate-500">
          Оплачено до{" "}
          {new Date(sub.currentPeriodEnd).toLocaleDateString("ru-RU")}
        </p>
      )}

      <div className="mt-8">
        <BillingManager currentSites={sitesLimit} />
      </div>
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
