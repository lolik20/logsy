import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

// Заглушка биллинга: «оплата» тарифа 300₽ за сайт. Активирует подписку и
// увеличивает лимит сайтов. Реальную интеграцию (YooKassa) можно добавить здесь.
const schema = z.object({
  sites: z.coerce.number().int().min(1).max(100).default(1),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const sites = parsed.success ? parsed.data.sites : 1;

  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      plan: "PAID",
      sitesLimit: sites,
      priceRub: 300 * sites,
      status: "active",
      currentPeriodEnd: periodEnd,
    },
    update: {
      plan: "PAID",
      sitesLimit: sites,
      priceRub: 300 * sites,
      status: "active",
      currentPeriodEnd: periodEnd,
    },
  });

  return NextResponse.json({ ok: true, subscription });
}
