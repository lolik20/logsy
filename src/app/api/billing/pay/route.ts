import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { initPayment, tbankConfigured, type ReceiptItem } from "@/lib/tbank";
import {
  getPlan,
  clampSessions,
  clampRetention,
  monthlyCustomPriceRub,
  customPriceRub,
  retentionHoursLabel,
  isFreeConfig,
  type CustomPlan,
} from "@/lib/pricing";

// Инициация оплаты кастомного тарифа проекта через Т-Кассу.
// Тарификация — за проект: пользователь ползунками задаёт суточную квоту сессий и
// срок хранения логов, доплата начисляется помесячно сверх бесплатного объёма
// (1 ₽/мес за сессию сверх 300, 10 ₽/мес за час хранения сверх 12).
// Период: 1 мес (без скидки) | 3 мес (−10%) | год (−20%). Создаёт платёж методом
// Init с чеком (Receipt: УСН + email пользователя) и возвращает PaymentURL.

const schema = z.object({
  projectId: z.string().min(1),
  sessionsPerDay: z.number().int().positive(),
  retentionHours: z.number().int().positive(),
  period: z.enum(["1m", "3m", "12m"]).default("1m"),
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

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { projectId, period } = parsed.data;
  const plan = getPlan(period)!;
  // Нормализуем конфигурацию к границам/шагу ползунков (клиенту не доверяем).
  const config: CustomPlan = {
    sessionsPerDay: clampSessions(parsed.data.sessionsPerDay),
    retentionHours: clampRetention(parsed.data.retentionHours),
  };
  // В пределах бесплатного объёма платить не за что.
  if (isFreeConfig(config) || monthlyCustomPriceRub(config) <= 0) {
    return NextResponse.json(
      { error: "Выбранная конфигурация бесплатна — оплата не требуется" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) {
    return NextResponse.json({ error: "У пользователя не указан email для чека" }, { status: 400 });
  }

  // Проект должен принадлежать пользователю.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, userId: true, name: true },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const amountRub = customPriceRub(config, plan);
  const amountKopecks = amountRub * 100;
  const configLabel = `${config.sessionsPerDay} сессий/сутки, хранение ${retentionHoursLabel(config.retentionHours)}`;

  // Создаём запись платежа — её id используем как OrderId.
  const payment = await prisma.payment.create({
    data: {
      userId,
      projectId,
      sessionsPerDay: config.sessionsPerDay,
      retentionHours: config.retentionHours,
      orderId: "",
      months: plan.months,
      amountRub,
      status: "NEW",
    },
  });
  const orderId = payment.id;
  await prisma.payment.update({ where: { id: payment.id }, data: { orderId } });

  const items: ReceiptItem[] = [
    {
      Name: `Logsy «${project.name}» — тариф (${configLabel}), ${plan.label}`,
      Price: amountKopecks,
      Quantity: 1,
      Amount: amountKopecks,
      Tax: "none", // УСН — без НДС
    },
  ];

  const base = appUrl();
  const returnUrl = `${base}/dashboard/projects/${projectId}/tariff`;

  try {
    const result = await initPayment({
      amountKopecks,
      orderId,
      description: `Тариф для «${project.name}» (${configLabel}), ${plan.label}, ${amountRub} ₽`,
      email: user.email,
      items,
      successUrl: `${returnUrl}?paid=1`,
      failUrl: `${returnUrl}?paid=0`,
      notificationUrl: `${base}/api/billing/tbank/notification`,
    });

    if (!result.Success || !result.PaymentURL) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
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
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "REJECTED" } });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ошибка при обращении к Т-Кассе" },
      { status: 502 },
    );
  }
}
