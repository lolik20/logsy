import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const patchSchema = z.object({
  checkSsl: z.boolean().optional(),
  checkDomain: z.boolean().optional(),
  feedbackEnabled: z.boolean().optional(),
  // Запись экрана сессий (rrweb): включает подгрузку рекордера на сайте проекта.
  recordSession: z.boolean().optional(),
  // Автоблок уведомления о cookie на сайте проекта.
  cookieBanner: z.boolean().optional(),
  // Автоблок с просьбой отключить VPN (показывается посетителям не из РФ).
  vpnNotice: z.boolean().optional(),
  // Порог «медленного» запроса в мс (0…60000). 0 — считать медленным любой запрос.
  slowMs: z.number().int().min(0).max(60000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  // При включении проверки сбрасываем OFF в PENDING, чтобы ближайший прогон
  // сразу проверил сертификат / срок регистрации.
  const data: {
    checkSsl?: boolean;
    sslStatus?: string;
    sslCheckedAt?: null;
    sslAlertHours?: null;
    checkDomain?: boolean;
    domainStatus?: string;
    domainCheckedAt?: null;
    domainAlertDays?: null;
    feedbackEnabled?: boolean;
    recordSession?: boolean;
    cookieBanner?: boolean;
    vpnNotice?: boolean;
    slowMs?: number;
  } = {};
  if (parsed.data.checkSsl !== undefined) {
    data.checkSsl = parsed.data.checkSsl;
    if (parsed.data.checkSsl) {
      data.sslStatus = "PENDING";
      data.sslCheckedAt = null;
      data.sslAlertHours = null;
    }
  }
  if (parsed.data.checkDomain !== undefined) {
    data.checkDomain = parsed.data.checkDomain;
    if (parsed.data.checkDomain) {
      data.domainStatus = "PENDING";
      data.domainCheckedAt = null;
      data.domainAlertDays = null;
    }
  }
  if (parsed.data.feedbackEnabled !== undefined) {
    data.feedbackEnabled = parsed.data.feedbackEnabled;
  }
  if (parsed.data.recordSession !== undefined) {
    data.recordSession = parsed.data.recordSession;
  }
  if (parsed.data.cookieBanner !== undefined) {
    data.cookieBanner = parsed.data.cookieBanner;
  }
  if (parsed.data.vpnNotice !== undefined) {
    data.vpnNotice = parsed.data.vpnNotice;
  }
  if (parsed.data.slowMs !== undefined) {
    data.slowMs = parsed.data.slowMs;
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
