// Скачивание PDF-отчёта по обходу. Рендерит «продающий» документ headless-браузером и отдаёт
// как файл на скачивание. Доступно только администраторам (кнопка «Скачать отчёт (PDF)»).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import type { ScanReport } from "@/lib/siteScanner";
import { renderReportPdf } from "@/lib/reportPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Безопасное имя файла из домена. */
function safeName(domain: string): string {
  return domain.replace(/[^a-z0-9.-]+/gi, "_").slice(0, 60) || "site";
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
    return NextResponse.json({ error: "Не удалось прочитать отчёт" }, { status: 500 });
  }

  try {
    const pdf = await renderReportPdf(report, scan.domain);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="logsy-report-${safeName(scan.domain)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("[Logsy] Не удалось сформировать PDF-отчёт:", err);
    return NextResponse.json(
      { error: "Не удалось сформировать PDF. Проверьте, что установлен Chromium." },
      { status: 502 },
    );
  }
}
