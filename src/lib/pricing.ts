// Тарифные планы Logsy Pro и расчёт цены со скидками за длительный период.
// Используется и на сервере (роут оплаты), и на клиенте (виджет оплаты),
// поэтому здесь не должно быть серверных импортов.

/** Базовая цена за один сайт в месяц, ₽. */
export const PRICE_PER_SITE_RUB = 300;

export type BillingPeriod = "1m" | "3m" | "12m";

export type PlanInfo = {
  id: BillingPeriod;
  /** Длительность в месяцах. */
  months: number;
  /** Скидка за период, %. */
  discountPercent: number;
  /** Подпись для интерфейса и чека. */
  label: string;
};

/** Доступные планы: 1 месяц (без скидки), 3 месяца (−20%), год (−30%). */
export const BILLING_PLANS: PlanInfo[] = [
  { id: "1m", months: 1, discountPercent: 0, label: "1 месяц" },
  { id: "3m", months: 3, discountPercent: 20, label: "3 месяца" },
  { id: "12m", months: 12, discountPercent: 30, label: "1 год" },
];

export function getPlan(id: string): PlanInfo | undefined {
  return BILLING_PLANS.find((p) => p.id === id);
}

/**
 * Цена за один сайт за весь период тарифа (со скидкой), ₽.
 * Считаем именно per-site, чтобы итог всегда делился на число сайтов —
 * так позиция чека Т-Кассы получается ровной (Price × Quantity = Amount).
 */
export function perSitePriceRub(plan: PlanInfo): number {
  return Math.round(PRICE_PER_SITE_RUB * plan.months * (1 - plan.discountPercent / 100));
}

/** Итоговая цена за N сайтов за весь период (со скидкой), ₽. */
export function totalPriceRub(plan: PlanInfo, sites: number): number {
  return perSitePriceRub(plan) * sites;
}

/** Цена за N сайтов за период без скидки (для показа зачёркнутой), ₽. */
export function basePriceRub(plan: PlanInfo, sites: number): number {
  return PRICE_PER_SITE_RUB * plan.months * sites;
}
