// Логика сервиса логирования: квоты по тарифу, ретеншн и очистка старых данных.
// Хранение — в основной PostgreSQL (модели LogSession/LogEvent/LogUsage).

import { prisma } from "@/lib/prisma";

/** Уровни тарифа проекта. */
export type Tier = "T300" | "T1000" | "T3000";

/** Суточная квота на число новых пользовательских сессий по тарифу. */
export function dailySessionQuota(tier: string | null | undefined): number {
  switch (tier) {
    case "T3000":
      return 10000;
    case "T1000":
      return 5000;
    case "T300":
    default:
      return 1000; // базовый и триал
  }
}

/** Срок хранения логов по тарифу, в сутках. */
export function retentionDays(tier: string | null | undefined): number {
  // Базовый тариф (T300) и триал — 1 сутки; T1000/T3000 — 3 суток.
  return tier === "T1000" || tier === "T3000" ? 3 : 1;
}

/** Максимальная длина текстовых полей события (стек/сообщение/тело запроса). */
export const MAX_TEXT_CHARS = 2000;
export const MAX_BODY_CHARS = 2000;

/** Усечь строку до лимита, добавив маркер обрезки. */
export function truncate(value: string | null | undefined, max = MAX_TEXT_CHARS): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Endpoint события — путь запроса без query-строки и хэша. Правила-исключения работают
 * по паре (тип + endpoint): игнорируется весь endpoint, а не запрос с конкретными
 * параметрами. Для событий без маршрута (например, JS-ошибок) возвращает null —
 * такие события исключить нельзя.
 */
export function endpointOf(route: string | null | undefined): string | null {
  if (!route) return null;
  const ep = route.split(/[?#]/)[0].trim();
  return ep || null;
}

/** Ключ правила-исключения: тип события + endpoint. Разделитель NUL не встречается в тексте. */
export function exceptionKey(e: { type: string; endpoint: string }): string {
  return `${e.type}\u0000${e.endpoint}`;
}

// Разрешённый набор меток перехода, которые SDK фиксирует при старте сессии:
// стандартные UTM-параметры и рекламные идентификаторы клика (Яндекс/Google/Facebook,
// в т.ч. etext текстовых объявлений Яндекс.Директа). Остальные query-параметры лендинга
// не сохраняем — только этот список, чтобы не тащить в БД произвольные данные.
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "yclid",
  "ysclid",
  "gclid",
  "fbclid",
  "etext",
] as const;

/** Максимальная длина значения метки перехода (etext Яндекс.Директа бывает длинным). */
export const MAX_UTM_VALUE_CHARS = 512;

/**
 * Нормализует метки перехода из батча SDK для колонки LogSession.utm: оставляет только
 * известные ключи (UTM_KEYS), усекает значения и сериализует в JSON. Возвращает null,
 * если валидных меток нет (прямой/органический переход) — доверять клиенту нельзя,
 * поэтому фильтрация ключей идёт на сервере.
 */
export function normalizeUtm(
  input: Record<string, string> | null | undefined,
): string | null {
  if (!input) return null;
  const out: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.length > MAX_UTM_VALUE_CHARS ? value.slice(0, MAX_UTM_VALUE_CHARS) : value;
    }
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

// Признаки автоматического клиента (краулеры, превью-боты, headless-браузеры,
// HTTP-библиотеки) в строке User-Agent. Такие клиенты исполняют наш SDK, но их
// «сессии» — мусор, поэтому события от них не сохраняем.
const BOT_UA_RE =
  /bot|crawler|spider|crawl|slurp|mediapartners|adsbot|bingpreview|headless|phantomjs|puppeteer|playwright|selenium|webdriver|lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|monitoring|facebookexternalhit|whatsapp|telegrambot|vkshare|skypeuripreview|discordbot|twitterbot|linkedinbot|embedly|preview|curl|wget|python-requests|axios|node-fetch|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|scrapy|zabbix/i;

/** Похоже ли на бота/автоматического клиента по строке User-Agent. */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  return BOT_UA_RE.test(userAgent);
}

/** Начало текущих суток (UTC) — ключ для суточного счётчика квоты. */
export function startOfDayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Учесть новую пользовательскую сессию за сегодня и вернуть, не превышена ли суточная
 * квота тарифа по числу сессий. Вызывается только для сессий, которых сегодня ещё не было.
 * Инкремент атомарный (upsert + increment). Возвращает { overQuota } — если true,
 * сессию и её события сохранять не нужно.
 */
export async function accountNewSession(
  projectId: string,
  tier: string | null | undefined,
  now: Date = new Date(),
): Promise<{ overQuota: boolean; totalSessions: number }> {
  const day = startOfDayUtc(now);
  const row = await prisma.logUsage.upsert({
    where: { projectId_day: { projectId, day } },
    create: { projectId, day, sessions: 1 },
    update: { sessions: { increment: 1 } },
  });
  return { overQuota: row.sessions > dailySessionQuota(tier), totalSessions: row.sessions };
}

/**
 * Удаляет логи, вышедшие за срок хранения тарифа проекта, и старые счётчики квоты.
 * Проекты группируются по сроку ретеншна, для каждого — один deleteMany.
 * Запускается по расписанию из планировщика (см. src/lib/scheduler.ts).
 */
export async function purgeExpiredLogs(now: Date = new Date()): Promise<{ deletedEvents: number }> {
  // Группируем проекты по числу суток хранения: 1 (T300/триал/без тарифа) и 3 (T1000/T3000).
  const projects = await prisma.project.findMany({ select: { id: true, tier: true } });
  const byDays = new Map<number, string[]>();
  for (const p of projects) {
    const days = retentionDays(p.tier);
    const list = byDays.get(days) ?? [];
    list.push(p.id);
    byDays.set(days, list);
  }

  let deletedEvents = 0;
  for (const [days, projectIds] of byDays) {
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    // Сначала события, затем пустые/устаревшие сессии.
    const ev = await prisma.logEvent.deleteMany({
      where: { projectId: { in: projectIds }, createdAt: { lt: cutoff } },
    });
    deletedEvents += ev.count;
    await prisma.logSession.deleteMany({
      where: { projectId: { in: projectIds }, lastSeenAt: { lt: cutoff } },
    });
  }

  // Счётчики квоты старше 7 дней больше не нужны.
  const usageCutoff = startOfDayUtc(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  await prisma.logUsage.deleteMany({ where: { day: { lt: usageCutoff } } });

  return { deletedEvents };
}
