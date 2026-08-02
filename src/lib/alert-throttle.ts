// Общий троттлинг оповещений из пользовательских сессий по «подписи» проблемы.
//
// Одна и та же (по подписи) проблема не должна уведомлять чаще заданного интервала, а
// параллельные батчи ингеста не должны задваивать отправку. Слот занимается атомарно:
// сначала условный update (пройдёт только у одного процесса, и только если интервал
// истёк), а если строки ещё нет — create (уникальный индекс пропустит только одного;
// проигравший ловит P2002 и молчит).
//
// Хранилище слотов общее для всех видов оповещений из сессий (ошибки —
// src/lib/error-alert.ts, rage-клики — src/lib/rage-alert.ts): таблица ErrorAlert.
// Подписи разных видов не пересекаются, потому что каждый модуль кладёт в ключ тип
// события (см. errorSignature / rageSignature), а хэшируется уже готовый ключ.

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Подпись оповещения: SHA-1 от ключа. Одинаковый ключ → одинаковая подпись. */
export function alertSignature(key: string): string {
  return createHash("sha1").update(key).digest("hex");
}

/**
 * Атомарно «занимает» слот троттлинга для одной подписи. Возвращает true, если по этой
 * проблеме пора уведомлять (её ещё не видели или с прошлого уведомления прошёл
 * throttleMs), и false, если уведомление о ней уже уходило недавно.
 */
export async function claimAlertSlot(
  projectId: string,
  signature: string,
  now: Date,
  throttleMs: number,
): Promise<boolean> {
  const threshold = new Date(now.getTime() - throttleMs);
  const updated = await prisma.errorAlert.updateMany({
    where: { projectId, signature, lastSentAt: { lt: threshold } },
    data: { lastSentAt: now },
  });
  if (updated.count > 0) return true;
  try {
    await prisma.errorAlert.create({ data: { projectId, signature, lastSentAt: now } });
    return true; // проблема встретилась впервые — уведомляем
  } catch (err) {
    // P2002 — строка уже есть и интервал не прошёл: недавно уведомляли, пропускаем.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}
