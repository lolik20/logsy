// Удаление спаршенного контакта (почты или телефона) из сохранённого отчёта обхода.
// Правит JSON-отчёт в SiteScan и синхронизирует счётчики. Доступно только администраторам.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import type { ScanReport } from "@/lib/siteScanner";

export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(["email", "phone"]),
  value: z.string().min(1).max(400),
});

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }
  const { type, value } = parsed.data;

  const scan = await prisma.siteScan.findUnique({ where: { id: params.id } });
  if (!scan) {
    return NextResponse.json({ error: "Обход не найден" }, { status: 404 });
  }

  let report: ScanReport;
  try {
    report = JSON.parse(scan.report) as ScanReport;
  } catch {
    return NextResponse.json({ error: "Не удалось прочитать отчёт" }, { status: 500 });
  }

  if (type === "email") {
    report.emails = (report.emails ?? []).filter((e) => e !== value);
    report.summary.emails = report.emails.length;
  } else {
    report.phones = (report.phones ?? []).filter((p) => p !== value);
    report.summary.phones = report.phones.length;
  }

  await prisma.siteScan.update({
    where: { id: scan.id },
    data: {
      report: JSON.stringify(report),
      emailsCount: report.summary.emails,
      phonesCount: report.summary.phones,
    },
  });

  return NextResponse.json({ emails: report.emails, phones: report.phones });
}
