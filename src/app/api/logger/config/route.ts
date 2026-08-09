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
  feedbackEnabled: boolean;
  slowMs: number;
  recordSession: boolean;
  cookieBanner: boolean;
  vpnNotice: boolean;
};

async function resolveProject(req: Request) {
  const { origin, host } = resolveRequestOrigin(req);
  if (!origin || !host) {
    return { origin, project: null as null | ProjectConfig };
  }
  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: {
      feedbackEnabled: true,
      slowMs: true,
      recordSession: true,
      cookieBanner: true,
      vpnNotice: true,
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

  return NextResponse.json(
    {
      feedback: project.feedbackEnabled,
      slowMs: project.slowMs,
      record: project.recordSession,
      cookie: project.cookieBanner,
      vpn,
    },
    { headers: corsHeaders(origin) },
  );
}
