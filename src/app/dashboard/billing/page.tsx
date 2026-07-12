import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { BillingManager } from "@/components/BillingManager";
import {
  describeSubscription,
  isSubscriptionActive,
  isTrialActive,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { paid?: string };
}) {
  const paid = searchParams?.paid;
  const userId = (await getUserId())!;
  const [sub, projectCount] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.project.count({ where: { userId } }),
  ]);

  const sitesLimit = sub?.sitesLimit ?? 1;
  const active = isSubscriptionActive(sub);
  const trial = isTrialActive(sub);
  const status = describeSubscription(sub);
  const periodEnd = status.periodEnd;

  const statusLabel = status.label;
  const statusValue = status.showPeriodEnd
    ? `${statusLabel} · до ${periodEnd}`
    : statusLabel;

  return (
    <div>
      <h1 className="text-2xl font-bold">Тарифы и подписка</h1>
      <p className="mt-1 text-sm text-slate-500">
        Тариф Pro — 300 ₽ за один сайт в месяц. Скидка 10% при оплате за 3 месяца
        и 20% при оплате за год.
      </p>

      {paid === "1" && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          ✅ Оплата прошла. Подписка активируется автоматически в течение
          пары минут после подтверждения платежа Т-Кассой — обновите страницу,
          если статус ещё не изменился.
        </div>
      )}

      {paid === "0" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Оплата не завершена. Вы можете попробовать снова.
        </div>
      )}

      {trial && periodEnd && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-300">
          🎁 Идёт бесплатный пробный период — до <b>{periodEnd}</b>. После
          окончания оформите подписку, чтобы мониторинг продолжил работать.
        </div>
      )}

      {!active && sub?.plan === "TRIAL" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Пробный период закончился. Оформите подписку, чтобы возобновить
          мониторинг.
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card label="Статус" value={statusValue} />
        <Card label="Лимит сайтов" value={`${sitesLimit}`} />
        <Card label="Используется" value={`${projectCount} из ${sitesLimit}`} />
      </div>

      {periodEnd && active && !trial && (
        <p className="mt-3 text-sm text-slate-500">Оплачено до {periodEnd}</p>
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
