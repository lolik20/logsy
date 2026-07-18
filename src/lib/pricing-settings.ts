// Загрузка и сохранение глобальных настроек тарификации (модель PricingSettings).
// Синглтон: всегда одна строка с фиксированным id. Если строки ещё нет — отдаём
// значения по умолчанию (DEFAULT_PRICING). Только серверный код.

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PRICING,
  MAX_SESSIONS_PER_DAY,
  MAX_RETENTION_HOURS,
  type PricingConfig,
} from "@/lib/pricing";

const SINGLETON_ID = "singleton";

/** Приводит значения настроек к разумным границам (защита от мусора). */
export function sanitizePricing(input: Partial<PricingConfig>): PricingConfig {
  const int = (v: unknown, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : def;
  };
  return {
    freeSessionsPerDay: Math.min(
      MAX_SESSIONS_PER_DAY,
      Math.max(0, int(input.freeSessionsPerDay, DEFAULT_PRICING.freeSessionsPerDay)),
    ),
    freeRetentionHours: Math.min(
      MAX_RETENTION_HOURS,
      Math.max(1, int(input.freeRetentionHours, DEFAULT_PRICING.freeRetentionHours)),
    ),
    rubPerSessionMonth: Math.max(0, int(input.rubPerSessionMonth, DEFAULT_PRICING.rubPerSessionMonth)),
    rubPerRetentionHourMonth: Math.max(
      0,
      int(input.rubPerRetentionHourMonth, DEFAULT_PRICING.rubPerRetentionHourMonth),
    ),
  };
}

/** Текущие настройки тарификации (или значения по умолчанию, если не заданы). */
export async function getPricingSettings(): Promise<PricingConfig> {
  const row = await prisma.pricingSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return DEFAULT_PRICING;
  return {
    freeSessionsPerDay: row.freeSessionsPerDay,
    freeRetentionHours: row.freeRetentionHours,
    rubPerSessionMonth: row.rubPerSessionMonth,
    rubPerRetentionHourMonth: row.rubPerRetentionHourMonth,
  };
}

/** Сохраняет настройки тарификации (создаёт синглтон при первом сохранении). */
export async function updatePricingSettings(
  input: Partial<PricingConfig>,
): Promise<PricingConfig> {
  const cfg = sanitizePricing(input);
  const row = await prisma.pricingSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...cfg },
    update: cfg,
  });
  return {
    freeSessionsPerDay: row.freeSessionsPerDay,
    freeRetentionHours: row.freeRetentionHours,
    rubPerSessionMonth: row.rubPerSessionMonth,
    rubPerRetentionHourMonth: row.rubPerRetentionHourMonth,
  };
}
