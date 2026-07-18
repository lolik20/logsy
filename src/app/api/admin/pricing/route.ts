import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { getPricingSettings, updatePricingSettings } from "@/lib/pricing-settings";

// Настройки кастомной тарификации. Читать и менять может только администратор.
// GET — текущие настройки; POST — сохранить новые (бесплатный объём и ставки).

export const dynamic = "force-dynamic";

const schema = z.object({
  freeSessionsPerDay: z.number().int().min(0),
  freeRetentionHours: z.number().int().min(1),
  rubPerSessionMonth: z.number().int().min(0),
  rubPerRetentionHourMonth: z.number().int().min(0),
});

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администратора" }, { status: 403 });
  }
  return NextResponse.json(await getPricingSettings());
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администратора" }, { status: 403 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const saved = await updatePricingSettings(parsed.data);
  return NextResponse.json(saved);
}
