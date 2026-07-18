// Тарифные планы Logsy и расчёт цены. Кастомная тарификация: базовый бесплатный
// объём (сессии + срок хранения логов), а сверх него — доплата по ползункам.
// Используется и на сервере (роут оплаты), и на клиенте (форма оплаты),
// поэтому здесь не должно быть серверных импортов.

// ------------------------------- Периоды оплаты -------------------------------

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

// --------------------------- Легаси per-site тарификация ---------------------------
// Старый биллинг «за сайт» (компонент BillingManager). Оставлен для совместимости —
// новый проектный биллинг считается кастомно (см. ниже).

/** Базовая цена за один сайт в месяц, ₽. */
export const PRICE_PER_SITE_RUB = 300;

/** Цена за один сайт за весь период тарифа (со скидкой), ₽. */
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

// ----------------------------- Кастомная тарификация -----------------------------
// Тарификация за проект настраивается ползунками: пользователь сам задаёт суточную
// квоту сессий и срок хранения логов. Базовый объём — бесплатный навсегда, сверх него
// начисляется помесячная доплата. Скидки за длительный период берутся из BILLING_PLANS.

/** Бесплатная суточная квота сессий. */
export const FREE_SESSIONS_PER_DAY = 300;
/** Бесплатный срок хранения логов, часов. */
export const FREE_RETENTION_HOURS = 12;

/** Доплата в месяц за каждую суточную сессию сверх бесплатных 300, ₽. */
export const RUB_PER_SESSION_MONTH = 2;
/** Доплата в месяц за каждый час хранения логов сверх бесплатных 12, ₽. */
export const RUB_PER_RETENTION_HOUR_MONTH = 10;

/** Верхняя граница ползунка суточных сессий. */
export const MAX_SESSIONS_PER_DAY = 50000;
/** Шаг ползунка суточных сессий. */
export const SESSIONS_STEP = 100;
/** Верхняя граница ползунка хранения (30 суток). */
export const MAX_RETENTION_HOURS = 720;
/** Шаг ползунка хранения, часов. */
export const RETENTION_STEP = 12;

/** Конфигурация проекта, которую задаёт пользователь ползунками. */
export type CustomPlan = {
  /** Суточная квота на число пользовательских сессий. */
  sessionsPerDay: number;
  /** Срок хранения логов, часов. */
  retentionHours: number;
};

/** Бесплатный набор параметров (состояние проекта по умолчанию). */
export const FREE_TIER = {
  name: "Бесплатный",
  sessionsPerDay: FREE_SESSIONS_PER_DAY,
  retentionHours: FREE_RETENTION_HOURS,
  sessionsLabel: `до ${FREE_SESSIONS_PER_DAY} сессий в сутки`,
  features: [
    "Uptime-мониторинг",
    "Логирование фронт-ошибок и сессий",
    `до ${FREE_SESSIONS_PER_DAY} сессий в сутки`,
    "Хранение логов 12 часов",
    "Алертинг",
  ],
} as const;

/** Округляет к ближайшему шагу и зажимает значение в границы [min, max]. */
function clampToStep(value: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(value)) return min;
  const rounded = Math.round(value / step) * step;
  return Math.min(max, Math.max(min, rounded));
}

/** Приводит число сессий к допустимому диапазону и шагу ползунка. */
export function clampSessions(value: number): number {
  return clampToStep(value, FREE_SESSIONS_PER_DAY, MAX_SESSIONS_PER_DAY, SESSIONS_STEP);
}

/** Приводит срок хранения к допустимому диапазону и шагу ползунка. */
export function clampRetention(value: number): number {
  return clampToStep(value, FREE_RETENTION_HOURS, MAX_RETENTION_HOURS, RETENTION_STEP);
}

/** На бесплатном ли объёме конфигурация (доплаты нет). */
export function isFreeConfig(cfg: CustomPlan): boolean {
  return (
    cfg.sessionsPerDay <= FREE_SESSIONS_PER_DAY &&
    cfg.retentionHours <= FREE_RETENTION_HOURS
  );
}

/** Помесячная цена конфигурации, ₽ (0 — если в пределах бесплатного объёма). */
export function monthlyCustomPriceRub(cfg: CustomPlan): number {
  const extraSessions = Math.max(0, cfg.sessionsPerDay - FREE_SESSIONS_PER_DAY);
  const extraHours = Math.max(0, cfg.retentionHours - FREE_RETENTION_HOURS);
  return extraSessions * RUB_PER_SESSION_MONTH + extraHours * RUB_PER_RETENTION_HOUR_MONTH;
}

/**
 * Цена конфигурации за весь период (со скидкой за длительность), ₽.
 * Скидка берётся из BILLING_PLANS (1м — 0%, 3м — −10%, год — −20%).
 */
export function customPriceRub(cfg: CustomPlan, plan: PlanInfo): number {
  return Math.round(monthlyCustomPriceRub(cfg) * plan.months * (1 - plan.discountPercent / 100));
}

/** Цена конфигурации за период без скидки (для зачёркнутой цены), ₽. */
export function customBasePriceRub(cfg: CustomPlan, plan: PlanInfo): number {
  return monthlyCustomPriceRub(cfg) * plan.months;
}

/** Человекочитаемый срок хранения логов («12 часов» / «3 суток»). */
export function retentionHoursLabel(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? "сутки" : "суток"}`;
  }
  return `${hours} ${hours === 1 ? "час" : "часов"}`;
}
