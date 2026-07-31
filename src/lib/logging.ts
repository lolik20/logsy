// Логика сервиса логирования: квоты по тарифу, ретеншн и очистка старых данных.
// Хранение — в основной PostgreSQL (модели LogSession/LogEvent/LogUsage).

import { prisma } from "@/lib/prisma";
import {
  FREE_SESSIONS_PER_DAY,
  FREE_RETENTION_HOURS,
  retentionHoursLabel,
} from "@/lib/pricing";

/**
 * Тарифные поля проекта, влияющие на квоты. Кастомные лимиты (sessionsPerDay,
 * retentionHours) действуют только пока тариф оплачен (billingStatus = ACTIVE и
 * оплаченный период не истёк); иначе проект работает на бесплатном объёме.
 */
export type QuotaProject = {
  billingStatus: string;
  currentPeriodEnd: Date | null;
  sessionsPerDay: number;
  retentionHours: number;
};

/** Оплачен ли кастомный тариф проекта прямо сейчас. */
function isPaidActive(
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!project || project.billingStatus !== "ACTIVE") return false;
  return !project.currentPeriodEnd || project.currentPeriodEnd.getTime() > now.getTime();
}

/** Суточная квота на число новых пользовательских сессий с учётом оплаты тарифа. */
export function dailySessionQuota(
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): number {
  if (isPaidActive(project, now)) {
    return Math.max(FREE_SESSIONS_PER_DAY, project!.sessionsPerDay);
  }
  return FREE_SESSIONS_PER_DAY;
}

/** Срок хранения логов проекта в часах с учётом оплаты тарифа. */
export function retentionHours(
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): number {
  if (isPaidActive(project, now)) {
    return Math.max(FREE_RETENTION_HOURS, project!.retentionHours);
  }
  return FREE_RETENTION_HOURS;
}

/** Человекочитаемый срок хранения логов проекта («12 часов» / «3 суток»). */
export function retentionLabel(
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): string {
  return retentionHoursLabel(retentionHours(project, now));
}

/** Максимальная длина текстовых полей события (стек/сообщение/тело запроса). */
export const MAX_TEXT_CHARS = 2000;
export const MAX_BODY_CHARS = 2000;

/** Форматирует длительность события из миллисекунд в секунды («1,24 с»). */
export function formatDurationSec(ms: number): string {
  return (ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 }) + " с";
}

/**
 * Длительность визита — от начала сессии до последнего действия («2 мин 14 с»).
 * Секунды скрываем от часа и выше: точность там уже не важна, а строка короче.
 */
export function formatSessionLength(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ч ${m} мин`;
  if (m > 0) return `${m} мин ${s} с`;
  return `${s} с`;
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
 *
 * Важно: сессия сверх квоты НЕ сохраняется как LogSession, поэтому на каждый следующий
 * батч того же браузера ingest снова видит её как «новую» и зовёт этот метод. Чтобы
 * счётчик не рос по числу батчей (то есть по числу логов, а не сессий), при уже
 * превышенной квоте (счётчик > quota) инкремент не делаем — значение фиксируется на
 * quota + 1 как признак превышения.
 */
export async function accountNewSession(
  projectId: string,
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): Promise<{ overQuota: boolean; totalSessions: number }> {
  const day = startOfDayUtc(now);
  const quota = dailySessionQuota(project, now);

  // Квота уже превышена ранее — больше не инкрементим (иначе счётчик раздувается по
  // числу батчей отклонённых сессий). Отдаём текущее значение как есть.
  const current = await prisma.logUsage.findUnique({
    where: { projectId_day: { projectId, day } },
    select: { sessions: true },
  });
  if (current && current.sessions > quota) {
    return { overQuota: true, totalSessions: current.sessions };
  }

  const row = await prisma.logUsage.upsert({
    where: { projectId_day: { projectId, day } },
    create: { projectId, day, sessions: 1 },
    update: { sessions: { increment: 1 } },
  });
  return { overQuota: row.sessions > quota, totalSessions: row.sessions };
}

/** Использование суточной квоты сессий проектом. */
export type SessionUsage = {
  /**
   * Сколько новых сессий учтено за сегодня (UTC), для показа. Ограничено сверху квотой:
   * ровно quota сессий помещается, следующие отклоняются, поэтому «использовано» не может
   * быть больше лимита. Заодно это защищает от старых раздутых значений счётчика.
   */
  used: number;
  /** Суточная квота тарифа по числу сессий. */
  quota: number;
  /** Доля использования квоты, 0..1 (для прогресс-бара). */
  ratio: number;
  /**
   * Превышена ли квота — новые сессии уже не принимаются. Совпадает с условием
   * overQuota в accountNewSession (счётчик > quota).
   */
  overLimit: boolean;
};

/**
 * Текущее использование суточной квоты сессий проектом: сколько новых сессий учтено
 * сегодня (UTC) и каков лимит по тарифу. Читает суточный счётчик LogUsage — тот же,
 * что инкрементит accountNewSession. Значение «использовано» ограничивается квотой:
 * счётчик может слегка превышать лимит (сентинел превышения), а реально принято не
 * больше quota сессий.
 */
export async function getSessionUsage(
  projectId: string,
  project: QuotaProject | null | undefined,
  now: Date = new Date(),
): Promise<SessionUsage> {
  const day = startOfDayUtc(now);
  const row = await prisma.logUsage.findUnique({
    where: { projectId_day: { projectId, day } },
    select: { sessions: true },
  });
  const counter = row?.sessions ?? 0;
  const quota = dailySessionQuota(project, now);
  const used = Math.min(counter, quota);
  return {
    used,
    quota,
    ratio: quota > 0 ? used / quota : 0,
    overLimit: counter > quota,
  };
}

/**
 * Удаляет логи, вышедшие за срок хранения тарифа проекта, и старые счётчики квоты.
 * Проекты группируются по сроку ретеншна, для каждого — один deleteMany.
 * Запускается по расписанию из планировщика (см. src/lib/scheduler.ts).
 */
export async function purgeExpiredLogs(now: Date = new Date()): Promise<{ deletedEvents: number }> {
  // Группируем проекты по эффективному сроку хранения в часах (с учётом оплаты).
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      billingStatus: true,
      currentPeriodEnd: true,
      sessionsPerDay: true,
      retentionHours: true,
    },
  });
  const byHours = new Map<number, string[]>();
  for (const p of projects) {
    const hours = retentionHours(p, now);
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
    // Чанки записи экрана живут тот же срок, что и события. Удаляем устаревшие явно
    // (не только каскадом от сессии): у долгих сессий старые чанки должны уходить.
    await prisma.recordingChunk.deleteMany({
      where: { projectId: { in: projectIds }, createdAt: { lt: cutoff } },
    });
    await prisma.logSession.deleteMany({
      where: { projectId: { in: projectIds }, lastSeenAt: { lt: cutoff } },
    });
  }

  // Счётчики квоты старше 7 дней больше не нужны.
  const usageCutoff = startOfDayUtc(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  await prisma.logUsage.deleteMany({ where: { day: { lt: usageCutoff } } });

  // Троттлинг-строки уведомлений об ошибках нужны только на час (окно лимита). Удаляем
  // те, что старше суток: если такая ошибка повторится, слот заведётся заново (см.
  // claimError в src/lib/error-alert.ts) — так таблица не растёт бесконечно.
  const errorAlertCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await prisma.errorAlert.deleteMany({ where: { lastSentAt: { lt: errorAlertCutoff } } });

  // Токены кнопки «Игнорировать ошибку» в Telegram живут, пока актуально само
  // сообщение с кнопкой. Через неделю считаем их протухшими и удаляем — старая кнопка
  // просто перестаёт срабатывать (см. TgIgnoreToken в prisma/schema.prisma).
  const tgTokenCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  await prisma.tgIgnoreToken.deleteMany({ where: { createdAt: { lt: tgTokenCutoff } } });

  // Привязки «ответить посетителю письмом из Telegram» живут дольше: переписка по
  // обращению может продолжиться и через недели. Через 30 дней ответ на старое
  // оповещение перестаёт распознаваться (см. TgReplyToken в prisma/schema.prisma).
  const tgReplyCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await prisma.tgReplyToken.deleteMany({ where: { createdAt: { lt: tgReplyCutoff } } });

  return { deletedEvents };
}
