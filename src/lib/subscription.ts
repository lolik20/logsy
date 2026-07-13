// Логика доступности сервиса по подписке: пробный период и платный тариф.

/** Длительность бесплатного пробного периода при регистрации. */
export const TRIAL_DAYS = 14;

/** Лимит сайтов на время пробного периода. */
export const TRIAL_SITES_LIMIT = 1;

export type SubscriptionLike = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
};

/**
 * Активна ли подписка прямо сейчас — то есть можно ли пользоваться сервисом
 * (мониторинг работает, можно добавлять проекты).
 *
 *  - TRIAL — пока не истёк пробный период (currentPeriodEnd в будущем);
 *  - PAID  — статус active и оплаченный период ещё не закончился;
 *  - FREE / прочее — неактивна.
 */
export function isSubscriptionActive(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;

  if (sub.plan === "TRIAL") {
    return !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() > now.getTime();
  }

  if (sub.plan === "PAID") {
    return (
      sub.status === "active" &&
      (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now.getTime())
    );
  }

  return false;
}

/**
 * Активен ли сервис для пользователя с учётом роли. Администратор всегда имеет
 * доступ (безлимитная подписка), для остальных — по правилам подписки.
 */
export function isServiceActive(
  sub: SubscriptionLike | null | undefined,
  isAdmin = false,
  now: Date = new Date(),
): boolean {
  return isAdmin || isSubscriptionActive(sub, now);
}

/** Признак безлимитного числа сайтов. */
export const UNLIMITED_SITES = Infinity;

/**
 * Лимит сайтов для пользователя с учётом роли. Для администратора — без
 * ограничений (UNLIMITED_SITES).
 */
export function resolveSitesLimit(
  sub: { sitesLimit?: number | null } | null | undefined,
  isAdmin = false,
): number {
  if (isAdmin) return UNLIMITED_SITES;
  return sub?.sitesLimit ?? 1;
}

/** Отображение лимита сайтов: «∞» для безлимита, число — в остальных случаях. */
export function formatSitesLimit(limit: number): string {
  return Number.isFinite(limit) ? String(limit) : "∞";
}

/** Идёт ли сейчас именно пробный период (для показа плашек в интерфейсе). */
export function isTrialActive(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  return sub?.plan === "TRIAL" && isSubscriptionActive(sub, now);
}

/** Дата окончания пробного периода от заданного момента. */
export function trialEndFrom(start: Date = new Date()): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

export type SubscriptionTone = "trial" | "active" | "inactive";

export type SubscriptionStatus = {
  /** Короткая подпись статуса: «Пробный период» / «Активна» / «Не активна». */
  label: string;
  /** Стилевой тон для плашки/индикатора. */
  tone: SubscriptionTone;
  /** Дата окончания текущего периода (пробного или оплаченного) в формате ru-RU. */
  periodEnd: string | null;
  /** Есть ли смысл показывать строку «до …» рядом со статусом. */
  showPeriodEnd: boolean;
};

/**
 * Единое описание текущего статуса баланса/подписки для интерфейса —
 * используется и в боковом меню, и на вкладке «Тарифы», чтобы данные
 * не расходились.
 */
export function describeSubscription(
  sub: SubscriptionLike | null | undefined,
  isAdmin = false,
  now: Date = new Date(),
): SubscriptionStatus {
  // У администратора — безлимитная подписка без срока действия.
  if (isAdmin) {
    return {
      label: "Безлимит",
      tone: "active",
      periodEnd: null,
      showPeriodEnd: false,
    };
  }

  const active = isSubscriptionActive(sub, now);
  const trial = isTrialActive(sub, now);
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("ru-RU")
    : null;

  const label = trial ? "Пробный период" : active ? "Активна" : "Не активна";
  const tone: SubscriptionTone = trial ? "trial" : active ? "active" : "inactive";

  return {
    label,
    tone,
    periodEnd,
    // Дату «до» показываем, пока подписка активна (и в пробном, и в платном периоде).
    showPeriodEnd: active && !!periodEnd,
  };
}
