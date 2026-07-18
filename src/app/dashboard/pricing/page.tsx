import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/session";
import { getPricingSettings } from "@/lib/pricing-settings";
import { PricingSettingsForm } from "@/components/PricingSettingsForm";

export const dynamic = "force-dynamic";

// Админ-вкладка «Тарифы» — глобальная настройка кастомной тарификации
// (бесплатный объём и помесячные ставки за сессии и хранение логов).
export default async function PricingSettingsPage() {
  if (!(await isAdmin())) notFound();

  const pricing = await getPricingSettings();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Тарифы</h1>
        <p className="text-sm text-slate-500">
          Настройка цен кастомного тарифа: бесплатный объём и помесячные ставки за
          сессии и хранение логов сверх него.
        </p>
      </div>

      <PricingSettingsForm initial={pricing} />
    </div>
  );
}
