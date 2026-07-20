// Запуск обхода сайта админ-инструментом «Обход». По одному URL бот обходит сайт «как
// браузер» и формирует отчёт (ошибки бэкенда, медленные запросы, статика, почты, телефоны).
// Обход синхронный и ограничен по времени/числу страниц (см. src/lib/siteScanner.ts).
// Каждый прогон сохраняется в SiteScan для истории. Доступно только администраторам.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { normalizeScanUrl, scanSite } from "@/lib/siteScanner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Обход может занять до ~50с — поднимаем лимит выполнения обработчика.
export const maxDuration = 60;

const schema = z.object({
  url: z.string().min(1, "Укажите адрес сайта").max(2000),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Доступ только для администраторов" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const url = normalizeScanUrl(parsed.data.url);
  if (!url) {
    return NextResponse.json(
      { error: "Некорректный или недопустимый адрес сайта" },
      { status: 400 },
    );
  }

  try {
    const report = await scanSite(url);

    // Сохраняем прогон для истории. Ошибка записи не должна ломать ответ.
    let scanId: string | null = null;
    try {
      const created = await prisma.siteScan.create({
        data: {
          domain: report.domain,
          url: report.finalUrl,
          statusCode: report.statusCode,
          pagesCrawled: report.pagesCrawled,
          requestsTotal: report.requestsTotal,
          errorsCount: report.summary.errors,
          slowCount: report.summary.slow,
          assetsCount: report.summary.assets,
          emailsCount: report.summary.emails,
          phonesCount: report.summary.phones,
          durationMs: report.durationMs,
          report: JSON.stringify(report),
        },
        select: { id: true },
      });
      scanId = created.id;
    } catch (err) {
      console.error("[Logsy] Не удалось сохранить прогон обхода:", err);
    }

    return NextResponse.json({ ...report, scanId });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Не удалось обойти сайт — попробуйте ещё раз";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
