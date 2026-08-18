// Конфигурация клиентского SDK для конкретного проекта.
//
// SDK один на все проекты и кэшируется на CDN (см. /api/logger/sdk), поэтому
// включённые для проекта опции нельзя «зашить» в сам скрипт. Вместо этого скрипт при
// загрузке дёргает этот эндпоинт и получает флаги проекта. Проект определяется по
// заголовку Origin (домен проекта уникален) — та же keyless-модель, что и в /ingest.
//
// Отдаём флаги проекта для SDK: включена ли обратная форма ошибок (feedback), порог
// «медленного» запроса (slowMs), включена ли запись экрана сессий (record), автоблок
// уведомления о cookie (cookie) и просьба отключить VPN (vpn). Данные не
// чувствительны, но, как и ingest, отвечаем ACAO только зарегистрированному домену —
// чтобы конфиг читал лишь свой сайт.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { resolveCountry } from "@/lib/geo";
import { resolveRequestOrigin } from "@/lib/logger-origin";
import { consentCheckboxText, currentDocVersions, legalDataFrom, legalDocUrl } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Заголовки CORS для разрешённого origin (эхо конкретного домена, не "*"). */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}

type ProjectConfig = {
  id: string;
  domain: string;
  feedbackEnabled: boolean;
  slowMs: number;
  recordSession: boolean;
  cookieBanner: boolean;
  vpnNotice: boolean;
  consentEnabled: boolean;
  legal: {
    publicSlug: string;
    consentMode: string;
    consentText: string | null;
    operatorType: string;
    operatorName: string;
    inn: string | null;
    ogrn: string | null;
    address: string | null;
    email: string;
    phone: string | null;
    siteUrl: string | null;
    collectsName: boolean;
    collectsEmail: boolean;
    collectsPhone: boolean;
    collectsAddress: boolean;
    collectsPayment: boolean;
    collectsCookies: boolean;
    purposes: string;
    thirdParties: string;
    usesMetrika: boolean;
    usesGa: boolean;
    usesMailing: boolean;
  } | null;
};

async function resolveProject(req: Request) {
  const { origin, host } = resolveRequestOrigin(req);
  if (!origin || !host) {
    return { origin, project: null as null | ProjectConfig };
  }
  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: {
      id: true,
      domain: true,
      feedbackEnabled: true,
      slowMs: true,
      recordSession: true,
      cookieBanner: true,
      vpnNotice: true,
      consentEnabled: true,
      legal: true,
    },
  });
  return { origin, project };
}

export async function OPTIONS(req: Request) {
  const { origin, project } = await resolveProject(req);
  if (!origin || !project) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request) {
  const { origin, project } = await resolveProject(req);
  // Домен не зарегистрирован — фичи выключены, CORS-заголовок не выдаём.
  if (!origin || !project) {
    return NextResponse.json({ feedback: false }, { status: 403 });
  }
  // Плашку «отключите VPN» показываем только посетителям не из РФ. Страну считаем
  // здесь, на сервере: запрос конфига приходит из браузера посетителя, поэтому IP в
  // заголовках — его собственный. Геолокация опциональна: если страну определить не
  // удалось (локальный/приватный адрес, недоступен внешний сервис), плашку не
  // показываем — лучше промолчать, чем показать её россиянину.
  let vpn = false;
  if (project.vpnNotice) {
    const country = await resolveCountry(getClientIp(req));
    vpn = country !== null && country !== "RU";
  }

  // Галочка согласия: SDK встраивает её в формы сайта, поэтому здесь отдаём готовый
  // текст и адреса опубликованных документов. Если документы ещё не опубликованы,
  // фичу не включаем — ссылка вела бы в пустоту.
  let consent: {
    mode: string;
    text: string;
    privacyUrl: string;
    consentUrl: string;
    offerUrl: string | null;
    marketing: boolean;
  } | null = null;
  if (project.consentEnabled && project.legal) {
    const versions = await currentDocVersions(project.id);
    if (versions.PRIVACY) {
      const data = legalDataFrom(project.legal, project.domain);
      consent = {
        mode: project.legal.consentMode,
        text: project.legal.consentText || consentCheckboxText(data),
        privacyUrl: legalDocUrl(project.legal.publicSlug, "PRIVACY"),
        consentUrl: legalDocUrl(project.legal.publicSlug, "CONSENT"),
        offerUrl: versions.OFFER ? legalDocUrl(project.legal.publicSlug, "OFFER") : null,
        marketing: project.legal.usesMailing,
      };
    }
  }

  return NextResponse.json(
    {
      feedback: project.feedbackEnabled,
      slowMs: project.slowMs,
      record: project.recordSession,
      cookie: project.cookieBanner,
      vpn,
      consent,
    },
    { headers: corsHeaders(origin) },
  );
}
