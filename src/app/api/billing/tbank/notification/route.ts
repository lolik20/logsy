import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyNotificationToken } from "@/lib/tbank";

// Нотификации от Т-Кассы о статусе платежа.
// Т-Касса шлёт POST с телом платежа и подписью Token. В ответ ждёт текст "OK".
// При статусе CONFIRMED активируем подписку пользователя.
// Документация: https://developer.tbank.ru/eacq/api/init (раздел про нотификации)

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return new NextResponse("ERROR", { status: 400 });

  if (!verifyNotificationToken(body)) {
    return new NextResponse("ERROR", { status: 403 });
  }

  const orderId = String(body.OrderId || "");
  const status = String(body.Status || "");
  const paymentId = body.PaymentId != null ? String(body.PaymentId) : null;

  if (!orderId) return new NextResponse("OK");

  const payment = await prisma.payment.findUnique({ where: { orderId } });
  // Платёж не наш — всё равно подтверждаем приём, чтобы Т-Касса не ретраила.
  if (!payment) return new NextResponse("OK");

  // Фиксируем актуальный статус платежа.
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status, paymentId: paymentId ?? payment.paymentId },
  });

  // Успешная оплата — активируем/продлеваем подписку. Делаем один раз.
  if (status === "CONFIRMED" && payment.status !== "CONFIRMED") {
    const existing = await prisma.subscription.findUnique({
      where: { userId: payment.userId },
    });

    // Оплаченные месяцы добавляем к текущей дате окончания, если подписка
    // ещё действует (продление), иначе отсчитываем от сегодняшнего дня.
    const now = new Date();
    const startFrom =
      existing?.currentPeriodEnd && existing.currentPeriodEnd.getTime() > now.getTime()
        ? new Date(existing.currentPeriodEnd)
        : now;
    const periodEnd = new Date(startFrom);
    periodEnd.setMonth(periodEnd.getMonth() + payment.months);

    await prisma.subscription.upsert({
      where: { userId: payment.userId },
      create: {
        userId: payment.userId,
        plan: "PAID",
        sitesLimit: payment.sites,
        priceRub: payment.amountRub,
        status: "active",
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan: "PAID",
        sitesLimit: payment.sites,
        priceRub: payment.amountRub,
        status: "active",
        currentPeriodEnd: periodEnd,
      },
    });
  }

  return new NextResponse("OK");
}
