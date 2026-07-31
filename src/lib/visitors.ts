// Вкладка «Пользователи» проекта: посетитель — это группа сессий с одним IP.
// Отдельной таблицы под пользователей нет, всё считается группировкой LogSession
// (см. src/app/dashboard/projects/[id]/users).

import type { Prisma } from "@prisma/client";

/** Метка группы сессий без определённого IP (совпадает со списком сессий). */
export const NO_IP = "Без IP";

/** Периоды, за которые можно смотреть посетителей (?days=N). */
export const VISITOR_PERIODS = [
  { days: 1, label: "Сутки" },
  { days: 7, label: "7 дней" },
  { days: 30, label: "30 дней" },
] as const;

/** Период по умолчанию — неделя. */
export const DEFAULT_VISITOR_DAYS = 7;

/** Разбирает ?days= в один из разрешённых периодов. */
export function parseVisitorDays(value: string | undefined): number {
  const n = Number(value);
  return VISITOR_PERIODS.some((p) => p.days === n) ? n : DEFAULT_VISITOR_DAYS;
}

/**
 * Условие выборки сессий одного посетителя. «Без IP» — это сессии, у которых
 * адрес не определился (null или пустая строка), они сведены в одну группу.
 */
export function visitorIpWhere(ip: string): Prisma.LogSessionWhereInput {
  return ip === NO_IP ? { OR: [{ ip: null }, { ip: "" }] } : { ip };
}

/**
 * Максимум сессий, которые берём для группировки за период. Ограничение защищает
 * страницу от проектов с большим трафиком; при достижении лимита показываем
 * подсказку, что данные обрезаны.
 */
export const VISITOR_SESSION_LIMIT = 1000;

/** Начало периода: N суток назад от текущего момента. */
export function visitorPeriodStart(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Локальная дата в формате YYYY-MM-DD (ключ дня для ссылок на общие логи). */
export function toDateInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
