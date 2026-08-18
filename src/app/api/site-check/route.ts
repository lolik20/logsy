// Публичная проверка сайта: тот же обход headless-браузером, что и в админ-инструменте
// «Обход», но в облегчённом профиле и с проверкой соответствия 152-ФЗ в отчёте.
//
// Отличия от админского запуска (см. /api/admin/scan):
//   • профиль PUBLIC_SCAN_PROFILE — 6 страниц вместо 20 и бюджет 40 с;
//   • формы НЕ отправляются: сайт чужой, слать его владельцу тестовые заявки нельзя;
//   • есть ограничения нагрузки — обход держит Chromium и стоит дорого:
//       – не больше PARALLEL одновременных обходов на весь процесс;
//       – не больше PER_IP_HOUR запусков с одного IP в час;
//       – повторная проверка того же домена в течение CACHE_MIN минут отдаёт прошлый отчёт.
//
// Каждый прогон сохраняется в SiteScan с source=PUBLIC — история публичных проверок
// видна админу там же, где админские обходы, и по найденным почтам работает аутрич.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { normalizeScanUrl, scanSite, PUBLIC_SCAN_PROFILE, type ScanReport } from "@/lib/siteScanner";
import { analyzeCompliance } from "@/lib/compliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Бюджет обхода 40 с плюс запуск браузера — держим тот же лимит, что у админского роута.
export const maxDuration = 60;

const PARALLEL = 2; // сколько обходов одновременно на процесс
const PER_IP_HOUR = 5; // запусков с одного IP в час
const CACHE_MIN = 15; // сколько минут отдавать прошлый отчёт по тому же домену

const schema = z.object({
  url: z.string().min(1, "Укажите адрес сайта").max(2000),
});

// Счётчик одновременных обходов живёт в памяти процесса: этого достаточно, чтобы один
// инстанс не запускал десяток браузеров разом.
let running = 0;

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const url = normalizeScanUrl(parsed.data.url);
  if (!url) {
    return NextResponse.json({ error: "Некорректный или недопустимый адрес сайта" }, { status: 400 });
  }
  const domain = url.hostname.toLowerCase();
  const ip = getClientIp(req);

  // Свежий отчёт по этому домену — отдаём его, не гоняя браузер второй раз.
  const cached = await prisma.siteScan.findFirst({
    where: { domain, createdAt: { gt: new Date(Date.now() - CACHE_MIN * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (cached) {
    return NextResponse.json({
      scanId: cached.id,
      cached: true,
      checkedAt: cached.createdAt,
      report: JSON.parse(cached.report) as ScanReport,
      compliance: cached.compliance ? JSON.parse(cached.compliance) : null,
    });
  }

  if (ip) {
    const recent = await prisma.siteScan.count({
      where: { ip, source: "PUBLIC", createdAt: { gt: new Date(Date.now() - 60 * 60_000) } },
    });
    if (recent >= PER_IP_HOUR) {
      return NextResponse.json(
        { error: `Больше ${PER_IP_HOUR} проверок в час с одного адреса не запускаем. Попробуйте позже.` },
        { status: 429 },
      );
    }
  }

  if (running >= PARALLEL) {
    return NextResponse.json(
      { error: "Сейчас идут другие проверки — попробуйте через минуту." },
      { status: 429 },
    );
  }

  running += 1;
  try {
    const report = await scanSite(url, PUBLIC_SCAN_PROFILE);
    const compliance = analyzeCompliance(report);

    // Ошибка записи не должна ломать ответ: отчёт пользователю важнее истории.
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
          source: "PUBLIC",
          ip,
          compliance: JSON.stringify(compliance),
          complianceScore: compliance.score,
        },
        select: { id: true },
      });
      scanId = created.id;
    } catch {
      /* история не записалась — не страшно */
    }

    return NextResponse.json({ scanId, cached: false, checkedAt: new Date(), report, compliance });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось проверить сайт";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    running -= 1;
  }
}
