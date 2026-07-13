// Логика сервиса логирования: квоты по тарифу, ретеншн и очистка старых данных.
// Хранение — в основной PostgreSQL (модели LogSession/LogEvent/LogUsage).

import { prisma } from "@/lib/prisma";

/** Уровни тарифа проекта. */
export type Tier = "T300" | "T1000" | "T3000";

const MB = 1024 * 1024;

/** Суточная квота на объём принятых логов по тарифу, в байтах. */
export function dailyQuotaBytes(tier: string | null | undefined): number {
  switch (tier) {
    case "T3000":
      return 5 * 1024 * MB; // 5 ГБ
    case "T1000":
      return 1024 * MB; // 1 ГБ
    case "T300":
    default:
      return 100 * MB; // 100 МБ (базовый и триал)
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

/** Начало текущих суток (UTC) — ключ для суточного счётчика квоты. */
export function startOfDayUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Учесть принятый объём логов за сегодня и вернуть, не превышена ли квота.
 * Инкремент атомарный (upsert + increment). Возвращает { overQuota } — если true,
 * события за этот батч сохранять не нужно.
 */
export async function accountUsage(
  projectId: string,
  tier: string | null | undefined,
  bytes: number,
  now: Date = new Date(),
): Promise<{ overQuota: boolean; totalBytes: number }> {
  const day = startOfDayUtc(now);
  const row = await prisma.logUsage.upsert({
    where: { projectId_day: { projectId, day } },
    create: { projectId, day, bytes: BigInt(bytes) },
    update: { bytes: { increment: BigInt(bytes) } },
  });
  const total = Number(row.bytes);
  return { overQuota: total > dailyQuotaBytes(tier), totalBytes: total };
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
