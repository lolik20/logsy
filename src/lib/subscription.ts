// Логика доступности сервиса по подписке: бесплатный и платный тариф.

/** Лимит сайтов на бесплатном тарифе. */
export const FREE_SITES_LIMIT = 1;

export type SubscriptionLike = {
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
};

/**
 * Активна ли подписка прямо сейчас — то есть можно ли пользоваться сервисом
 * (мониторинг работает, можно добавлять проекты).
 *
 *  - FREE — бесплатный тариф, действует всегда;
 *  - PAID — статус active и оплаченный период ещё не закончился;
 *  - прочее — неактивна.
 */
export function isSubscriptionActive(
  sub: SubscriptionLike | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;

  if (isFreePlan(sub)) return true;

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

/**
 * Бесплатный ли сейчас тариф (для показа плашек в интерфейсе). Легаси-план «TRIAL»
 * (от отменённого пробного периода) тоже считаем бесплатным тарифом.
 */
export function isFreePlan(sub: SubscriptionLike | null | undefined): boolean {
  return sub?.plan === "FREE" || sub?.plan === "TRIAL";
}

export type SubscriptionTone = "free" | "active" | "inactive";

export type SubscriptionStatus = {
  /** Короткая подпись статуса: «Бесплатный тариф» / «Активна» / «Не активна». */
  label: string;
  /** Стилевой тон для плашки/индикатора. */
  tone: SubscriptionTone;
  /** Дата окончания оплаченного периода в формате ru-RU. */
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
  const free = isFreePlan(sub);
  const periodEnd = sub?.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString("ru-RU")
    : null;

  const label = free ? "Бесплатный тариф" : active ? "Активна" : "Не активна";
  const tone: SubscriptionTone = free ? "free" : active ? "active" : "inactive";

  return {
    label,
    tone,
    periodEnd,
    // Дату «до» показываем только для платного тарифа с известным сроком окончания.
    showPeriodEnd: active && !free && !!periodEnd,
  };
}

// ------------------------- Биллинг на уровне проекта -------------------------
// Тарификация переехала с per-user подписки на per-project тариф. Ниже — аналоги
// проверок активности и описания статуса, но для конкретного проекта.

export type ProjectBillingLike = {
  billingStatus: string; // FREE | ACTIVE | INACTIVE
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
};

/**
 * Активен ли сервис для проекта прямо сейчас (работает мониторинг/логирование):
 *  - FREE   — бесплатный тариф, действует всегда;
 *  - ACTIVE — оплаченный период ещё не закончился;
 *  - иначе  — неактивен.
 * Администратор имеет доступ всегда.
 */
export function isProjectServiceActive(
  project: ProjectBillingLike | null | undefined,
  isAdmin = false,
  now: Date = new Date(),
): boolean {
  if (isAdmin) return true;
  if (!project) return false;

  if (isProjectFree(project)) return true;
  if (project.billingStatus === "ACTIVE") {
    return !project.currentPeriodEnd || project.currentPeriodEnd.getTime() > now.getTime();
  }
  return false;
}

/**
 * На бесплатном ли тарифе сейчас проект. Легаси-статус «TRIAL» (от отменённого
 * пробного периода) тоже считаем бесплатным тарифом, чтобы старые проекты
 * продолжили работать без миграции.
 */
export function isProjectFree(
  project: ProjectBillingLike | null | undefined,
): boolean {
  return project?.billingStatus === "FREE" || project?.billingStatus === "TRIAL";
}

/**
 * Описание статуса тарифа проекта для интерфейса (плашки в меню и на вкладке «Тариф»).
 */
export function describeProjectBilling(
  project: ProjectBillingLike | null | undefined,
  isAdmin = false,
  now: Date = new Date(),
): SubscriptionStatus {
  if (isAdmin) {
    return { label: "Безлимит", tone: "active", periodEnd: null, showPeriodEnd: false };
  }

  const active = isProjectServiceActive(project, false, now);
  const free = isProjectFree(project);
  const periodEnd = project?.currentPeriodEnd
    ? new Date(project.currentPeriodEnd).toLocaleDateString("ru-RU")
    : null;

  const label = free ? "Бесплатный тариф" : active ? "Активен" : "Не активен";
  const tone: SubscriptionTone = free ? "free" : active ? "active" : "inactive";

  // Дату «до» показываем только для платного тарифа с известным сроком окончания.
  return { label, tone, periodEnd, showPeriodEnd: active && !free && !!periodEnd };
}
