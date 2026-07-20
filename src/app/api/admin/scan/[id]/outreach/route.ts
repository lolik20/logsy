// Рассылка холодных писем по найденным при обходе почтам и статус рассылки.
// GET  — текущее состояние рассылки по обходу (кому отправлено, открытия, отписки).
// POST — отправить письмо на все найденные почты (кроме уже отправленных и отписавшихся).
// Доступно только администраторам. Письмо со «скриншотом» отчёта собирает src/lib/outreach.ts.

import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { sendMail } from "@/lib/mailer";
import type { ScanReport } from "@/lib/siteScanner";
import { buildOutreachEmail, renderReportScreenshot } from "@/lib/outreach";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_RECIPIENTS = 50; // защита от массовой рассылки за один запрос

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 });
  }
  const items = await prisma.scanOutreach.findMany({
    where: { scanId: params.id },
    orderBy: { createdAt: "desc" },
    select: {
      toEmail: true,
      status: true,
      openCount: true,
      firstOpenedAt: true,
      lastOpenedAt: true,
      unsubscribedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ items });
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 });
  }

  const scan = await prisma.siteScan.findUnique({ where: { id: params.id } });
  if (!scan) {
    return NextResponse.json({ error: "Обход не найден" }, { status: 404 });
  }

  let report: ScanReport;
  try {
    report = JSON.parse(scan.report) as ScanReport;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать отчёт обхода" }, { status: 500 });
  }

  const emails = Array.from(new Set(report.emails.map((e) => e.trim().toLowerCase()))).filter(
    Boolean,
  );
  if (emails.length === 0) {
    return NextResponse.json({ error: "На сайте не найдено почт для рассылки" }, { status: 400 });
  }

  // Уже отправленные в рамках этого обхода — пропускаем.
  const already = await prisma.scanOutreach.findMany({
    where: { scanId: scan.id },
    select: { toEmail: true },
  });
  const alreadySet = new Set(already.map((a) => a.toEmail));
  // Отписавшиеся (по любому обходу) — не пишем.
  const unsub = await prisma.scanOutreach.findMany({
    where: { toEmail: { in: emails }, unsubscribedAt: { not: null } },
    select: { toEmail: true },
  });
  const unsubSet = new Set(unsub.map((u) => u.toEmail));

  const targets = emails.filter((e) => !alreadySet.has(e) && !unsubSet.has(e)).slice(0, MAX_RECIPIENTS);

  if (targets.length === 0) {
    return NextResponse.json({
      sent: 0,
      failed: 0,
      skipped: emails.length,
      message: "Всем найденным адресам уже отправлено (или они отписались).",
    });
  }

  // Скриншот отчёта рендерим один раз на всю рассылку (общий CID-вложение).
  const shot = await renderReportScreenshot(report, scan.domain);

  let sent = 0;
  let failed = 0;

  for (const toEmail of targets) {
    const token = crypto.randomBytes(16).toString("hex");
    const mail = buildOutreachEmail({
      report,
      domain: scan.domain,
      token,
      hasShot: !!shot,
    });
    try {
      await sendMail({
        to: toEmail,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        replyTo: process.env.SMTP_FROM?.match(/<([^>]+)>/)?.[1] || process.env.SMTP_USER,
        headers: {
          "List-Unsubscribe": mail.listUnsubscribe,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        attachments: shot
          ? [{ filename: "report.png", content: shot, contentType: "image/png", cid: "reportshot" }]
          : undefined,
      });
      await prisma.scanOutreach.create({
        data: {
          scanId: scan.id,
          domain: scan.domain,
          toEmail,
          subject: mail.subject,
          status: "SENT",
          token,
        },
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error(`[Logsy] Не удалось отправить письмо на ${toEmail}:`, err);
      await prisma.scanOutreach
        .create({
          data: {
            scanId: scan.id,
            domain: scan.domain,
            toEmail,
            subject: mail.subject,
            status: "FAILED",
            error: err instanceof Error ? err.message.slice(0, 500) : "Ошибка отправки",
            token,
          },
        })
        .catch(() => {});
    }
  }

  return NextResponse.json({
    sent,
    failed,
    skipped: emails.length - targets.length,
    screenshot: !!shot,
  });
}
