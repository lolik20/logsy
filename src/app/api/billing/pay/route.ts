import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { initPayment, tbankConfigured, type ReceiptItem } from "@/lib/tbank";

// Инициация оплаты тарифа Pro (300 ₽ за сайт/мес) через Т-Кассу.
// Создаёт платёж методом Init с чеком (Receipt: УСН + email пользователя)
// и возвращает PaymentURL для редиректа на страницу оплаты.

const PRICE_PER_SITE_RUB = 300;

const schema = z.object({
  sites: z.coerce.number().int().min(1).max(100).default(1),
});

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
}

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  if (!tbankConfigured()) {
    return NextResponse.json(
      { error: "Оплата временно недоступна: не настроена Т-Касса" },
      { status: 503 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) {
    return NextResponse.json({ error: "У пользователя не указан email для чека" }, { status: 400 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  const sites = parsed.success ? parsed.data.sites : 1;

  const amountRub = PRICE_PER_SITE_RUB * sites;
  const amountKopecks = amountRub * 100;
  const pricePerSiteKopecks = PRICE_PER_SITE_RUB * 100;

  // Создаём запись платежа — её id используем как OrderId.
  const payment = await prisma.payment.create({
    data: { userId, orderId: "", sites, amountRub, status: "NEW" },
  });
  const orderId = payment.id;
  await prisma.payment.update({ where: { id: payment.id }, data: { orderId } });

  const items: ReceiptItem[] = [
    {
      Name: `Подписка Logsy Pro — ${sites} ${pluralSite(sites)}`,
      Price: pricePerSiteKopecks,
      Quantity: sites,
      Amount: amountKopecks,
      Tax: "none", // УСН — без НДС
    },
  ];

  const base = appUrl();

  try {
    const result = await initPayment({
      amountKopecks,
      orderId,
      description: `Тариф Pro, ${sites} ${pluralSite(sites)}, ${amountRub} ₽/мес`,
      email: user.email,
      items,
      successUrl: `${base}/dashboard/billing?paid=1`,
      failUrl: `${base}/dashboard/billing?paid=0`,
      notificationUrl: `${base}/api/billing/tbank/notification`,
    });

    if (!result.Success || !result.PaymentURL) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "REJECTED" },
      });
      return NextResponse.json(
        { error: result.Message || result.Details || "Не удалось создать платёж" },
        { status: 502 },
      );
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentId: result.PaymentId ?? null, status: result.Status ?? "NEW" },
    });

    return NextResponse.json({ url: result.PaymentURL });
  } catch (e) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "REJECTED" },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка при обращении к Т-Кассе" },
      { status: 502 },
    );
  }
}

function pluralSite(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "сайт";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "сайта";
  return "сайтов";
}
