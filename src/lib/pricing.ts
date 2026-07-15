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
// Тарификация идёт за проект (а не за сайт мониторинга): бесплатный тариф плюс два
// платных уровня, в каждый входит uptime-мониторинг, логирование с суточной квотой по
// числу сессий и алертинг. Скидки за длительный период переиспользуются из BILLING_PLANS.

export type TierId = "T1000" | "T3000";

export type TierInfo = {
  id: TierId;
  /** Цена за месяц, ₽. */
  monthlyRub: number;
  /** Название тарифа для интерфейса. */
  name: string;
  /** Суточная квота на число пользовательских сессий. */
  sessionsPerDay: number;
  /** Сколько суток хранятся логи. */
  retentionDays: number;
  /** Короткое человекочитаемое описание квоты сессий. */
  sessionsLabel: string;
  /** Список того, что входит в тариф (для карточек цен). */
  features: string[];
};

/**
 * Бесплатный тариф — состояние проекта по умолчанию (billingStatus = FREE, tier = null).
 * Действует без ограничения по времени: 300 сессий в сутки и хранение логов 12 часов.
 * Не участвует в оплате, поэтому описан отдельно от платных TIERS.
 */
export const FREE_TIER = {
  name: "Бесплатный",
  sessionsPerDay: 300,
  retentionHours: 12,
  sessionsLabel: "до 300 сессий в сутки",
  features: [
    "Uptime-мониторинг",
    "Логирование фронт-ошибок и сессий",
    "до 300 сессий в сутки",
    "Хранение логов 12 часов",
    "Алертинг",
  ],
} as const;

export const TIERS: TierInfo[] = [
  {
    id: "T1000",
    monthlyRub: 1000,
    name: "Про",
    sessionsPerDay: 5000,
    retentionDays: 3,
    sessionsLabel: "до 5000 сессий в сутки",
    features: [
      "Uptime-мониторинг",
      "Логирование фронт-ошибок и сессий",
      "до 5000 сессий в сутки",
      "Хранение логов 3 суток",
      "Алерты",
    ],
  },
  {
    id: "T3000",
    monthlyRub: 3000,
    name: "Бизнес",
    sessionsPerDay: 10000,
    retentionDays: 3,
    sessionsLabel: "до 10 000 сессий в сутки",
    features: [
      "Uptime-мониторинг",
      "Логирование фронт-ошибок и сессий",
      "до 10 000 сессий в сутки",
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
