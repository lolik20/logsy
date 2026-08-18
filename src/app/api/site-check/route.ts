// Публичная проверка сайта: тот же обход headless-браузером, что и в админ-инструменте
// «Обход», но в облегчённом профиле и с проверкой соответствия 152-ФЗ в отчёте.
//
// Отличия от админского запуска (см. /api/admin/scan):
//   • профиль PUBLIC_SCAN_PROFILE — 6 страниц вместо 20 и бюджет 40 с;
//   • формы НЕ отправляются: сайт чужой, слать его владельцу тестовые заявки нельзя;
//   • есть ограничения нагрузки — обход держит Chromium и стоит дорого:
//       – не больше PARALLEL одновременных обходов на весь процесс;
//       – не больше PER_IP_HOUR запусков с одного IP в час;
//       – повторная проверка того же домена раньше COOLDOWN_MIN минут отклоняется.
//
// Уже собранные отчёты наружу НЕ отдаются: на запрос всегда идёт свой обход, а если по
// этому домену недавно уже ходили — приходит отказ с просьбой подождать. Иначе через
// публичный адрес можно было бы вытащить чужой прогон, в том числе админский (он глубже
// и отправляет формы). Из ответа дополнительно вырезаются собранные со страниц контакты.
//
// Каждый прогон сохраняется в SiteScan с source=PUBLIC — история публичных проверок
// видна админу там же, где админские обходы, и по найденным почтам работает аутрич.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { normalizeScanUrl, scanSite, toPublicReport, PUBLIC_SCAN_PROFILE } from "@/lib/siteScanner";
import { analyzeCompliance } from "@/lib/compliance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Бюджет обхода 40 с плюс запуск браузера — держим тот же лимит, что у админского роута.
export const maxDuration = 60;

const PARALLEL = 2; // сколько обходов одновременно на процесс
const PER_IP_HOUR = 5; // запусков с одного IP в час
const COOLDOWN_MIN = 15; // как скоро можно проверить тот же домен повторно

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

  // Недавно этот домен уже проверяли — отказываем, а не отдаём прошлый отчёт.
  // Отдать сохранённый прогон значило бы показать постороннему чужие данные, поэтому
  // здесь только защита сайта-цели от повторных обходов.
  const recentForDomain = await prisma.siteScan.findFirst({
    where: {
      domain,
      source: "PUBLIC",
      createdAt: { gt: new Date(Date.now() - COOLDOWN_MIN * 60_000) },
    },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (recentForDomain) {
    const waitMin = Math.max(
      1,
      COOLDOWN_MIN - Math.floor((Date.now() - recentForDomain.createdAt.getTime()) / 60_000),
    );
    return NextResponse.json(
      { error: `Этот сайт недавно проверяли. Следующая проверка будет доступна через ${waitMin} мин.` },
      { status: 429 },
    );
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

    // Наружу — очищенный отчёт: собранные со страниц почты и телефоны остаются только
    // в сохранённом прогоне, который виден админу.
    return NextResponse.json({
      scanId,
      checkedAt: new Date(),
      report: toPublicReport(report),
      compliance,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось проверить сайт";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    running -= 1;
  }
}
