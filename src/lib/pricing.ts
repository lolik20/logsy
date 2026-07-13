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

/** Доступные планы: 1 месяц (без скидки), 3 месяца (−10%), год (−20%). */
export const BILLING_PLANS: PlanInfo[] = [
  { id: "1m", months: 1, discountPercent: 0, label: "1 месяц" },
  { id: "3m", months: 3, discountPercent: 10, label: "3 месяца" },
  { id: "12m", months: 12, discountPercent: 20, label: "1 год" },
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

// ------------------------------- Тарифы за проект -------------------------------
// Тарификация теперь идёт за проект (а не за сайт мониторинга): три уровня, в каждый
// входит uptime-мониторинг, логирование с суточной квотой и алертинг. Скидки за длительный
// период переиспользуются из BILLING_PLANS.

export type TierId = "T300" | "T1000" | "T3000";

export type TierInfo = {
  id: TierId;
  /** Цена за месяц, ₽. */
  monthlyRub: number;
  /** Название тарифа для интерфейса. */
  name: string;
  /** Суточная квота логов, МБ. */
  logsMbPerDay: number;
  /** Сколько суток хранятся логи. */
  retentionDays: number;
  /** Короткое человекочитаемое описание квоты логов. */
  logsLabel: string;
  /** Список того, что входит в тариф (для карточек цен). */
  features: string[];
};

export const TIERS: TierInfo[] = [
  {
    id: "T300",
    monthlyRub: 300,
    name: "Старт",
    logsMbPerDay: 100,
    retentionDays: 1,
    logsLabel: "до 100 МБ логов в день",
    features: [
      "Uptime-мониторинг",
      "Логирование фронт-ошибок и сессий",
      "до 100 МБ логов в день",
      "Хранение логов 1 сутки",
      "Алертинг",
    ],
  },
  {
    id: "T1000",
    monthlyRub: 1000,
    name: "Про",
    logsMbPerDay: 1024,
    retentionDays: 3,
    logsLabel: "до 1 ГБ логов в день",
    features: [
      "Uptime-мониторинг",
      "Логирование фронт-ошибок и сессий",
      "до 1 ГБ логов в день",
      "Хранение логов 3 суток",
      "Алерты",
    ],
  },
  {
    id: "T3000",
    monthlyRub: 3000,
    name: "Бизнес",
    logsMbPerDay: 5120,
    retentionDays: 3,
    logsLabel: "до 5 ГБ логов в день",
    features: [
      "Uptime-мониторинг",
      "Логирование фронт-ошибок и сессий",
      "до 5 ГБ логов в день",
      "Хранение логов 3 суток",
      "AI-анализ ошибок",
      "Алерты",
      "Приоритетная поддержка",
    ],
  },
];

export function getTier(id: string | null | undefined): TierInfo | undefined {
  return TIERS.find((t) => t.id === id);
}

/**
 * Цена тарифа за весь период (со скидкой за длительность), ₽.
 * Скидка берётся из BILLING_PLANS (1м — 0%, 3м — −10%, год — −20%),
 * так же как в perSitePriceRub, чтобы позиция чека делилась ровно.
 */
export function tierPriceRub(tier: TierInfo, plan: PlanInfo): number {
  return Math.round(tier.monthlyRub * plan.months * (1 - plan.discountPercent / 100));
}

/** Цена тарифа за период без скидки (для зачёркнутой цены), ₽. */
export function tierBasePriceRub(tier: TierInfo, plan: PlanInfo): number {
  return tier.monthlyRub * plan.months;
}
