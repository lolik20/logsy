// Логика сервиса логирования: квоты по тарифу, ретеншн и очистка старых данных.
// Хранение — в основной PostgreSQL (модели LogSession/LogEvent/LogUsage).

import { prisma } from "@/lib/prisma";

/** Уровни платного тарифа проекта. */
export type Tier = "T1000" | "T3000";

/** Суточная квота на число новых пользовательских сессий по тарифу. */
export function dailySessionQuota(tier: string | null | undefined): number {
  switch (tier) {
    case "T3000":
      return 10000;
    case "T1000":
      return 5000;
    default:
      return 300; // бесплатный тариф (tier не выбран)
  }
}

/** Срок хранения логов по тарифу, в часах. */
export function retentionHours(tier: string | null | undefined): number {
  // Бесплатный тариф — 12 часов; T1000/T3000 — 3 суток (72 часа).
  return tier === "T1000" || tier === "T3000" ? 72 : 12;
}

/** Человекочитаемый срок хранения логов по тарифу («12 часов» / «3 суток»). */
export function retentionLabel(tier: string | null | undefined): string {
  const hours = retentionHours(tier);
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? "сутки" : "суток"}`;
  }
  return `${hours} ${hours === 1 ? "час" : "часов"}`;
}

/** Максимальная длина текстовых полей события (стек/сообщение/тело запроса). */
export const MAX_TEXT_CHARS = 2000;
export const MAX_BODY_CHARS = 2000;

/** Форматирует длительность события из миллисекунд в секунды («1,24 с»). */
export function formatDurationSec(ms: number): string {
  return (ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " с";
}

/** Усечь строку до лимита, добавив маркер обрезки. */
export function truncate(value: string | null | undefined, max = MAX_TEXT_CHARS): string | null {
  if (value == null) return null;
  const s = String(value);
  return s.length > max ? s.slice(0, max) + "…" : s;
}

/**
 * Усечь очень длинную ссылку для показа: сохраняет начало (домен/путь) и хвост
 * (последний сегмент/параметр), а середину заменяет на «…». Для URL это читабельнее
 * обычной обрезки с конца — видно и хост, и куда именно ведёт ссылка. Полный URL
 * стоит отдавать отдельно (например, в атрибуте title) для показа по наведению.
 */
export function truncateUrl(url: string | null | undefined, max = 80): string {
  const s = String(url ?? "");
  if (s.length <= max) return s;
  const keep = max - 1; // один символ на многоточие
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return s.slice(0, head) + "…" + s.slice(s.length - tail);
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

/** Использование суточной квоты сессий проектом. */
export type SessionUsage = {
  /** Сколько новых сессий учтено за сегодня (UTC). */
  used: number;
  /** Суточная квота тарифа по числу сессий. */
  quota: number;
  /** Доля использования квоты, 0..1 (для прогресс-бара). */
  ratio: number;
  /**
   * Превышена ли квота — новые сессии уже не принимаются. Совпадает с условием
   * overQuota в accountNewSession (used > quota): ровно quota сессий помещается,
   * следующая отбрасывается.
   */
  overLimit: boolean;
};

/**
 * Текущее использование суточной квоты сессий проектом: сколько новых сессий учтено
 * сегодня (UTC) и каков лимит по тарифу. Читает суточный счётчик LogUsage — тот же,
 * что инкрементит accountNewSession, поэтому цифры совпадают с реальным приёмом логов.
 */
export async function getSessionUsage(
  projectId: string,
  tier: string | null | undefined,
  now: Date = new Date(),
): Promise<SessionUsage> {
  const day = startOfDayUtc(now);
  const row = await prisma.logUsage.findUnique({
    where: { projectId_day: { projectId, day } },
    select: { sessions: true },
  });
  const used = row?.sessions ?? 0;
  const quota = dailySessionQuota(tier);
  return {
    used,
    quota,
    ratio: quota > 0 ? Math.min(used / quota, 1) : 0,
    overLimit: used > quota,
  };
}

/**
 * Удаляет логи, вышедшие за срок хранения тарифа проекта, и старые счётчики квоты.
 * Проекты группируются по сроку ретеншна, для каждого — один deleteMany.
 * Запускается по расписанию из планировщика (см. src/lib/scheduler.ts).
 */
export async function purgeExpiredLogs(now: Date = new Date()): Promise<{ deletedEvents: number }> {
  // Группируем проекты по сроку хранения в часах: 12 (бесплатный) и 72 (T1000/T3000).
  const projects = await prisma.project.findMany({ select: { id: true, tier: true } });
  const byHours = new Map<number, string[]>();
  for (const p of projects) {
    const hours = retentionHours(p.tier);
    const list = byHours.get(hours) ?? [];
    list.push(p.id);
    byHours.set(hours, list);
  }

  let deletedEvents = 0;
  for (const [hours, projectIds] of byHours) {
    const cutoff = new Date(now.getTime() - hours * 60 * 60 * 1000);
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
