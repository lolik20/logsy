// Конфигурация клиентского SDK для конкретного проекта.
//
// SDK один на все проекты и кэшируется на CDN (см. /api/logger/sdk), поэтому
// включённые для проекта опции нельзя «зашить» в сам скрипт. Вместо этого скрипт при
// загрузке дёргает этот эндпоинт и получает флаги проекта. Проект определяется по
// заголовку Origin (домен проекта уникален) — та же keyless-модель, что и в /ingest.
//
// Сейчас отдаём единственный флаг: включена ли обратная форма ошибок (feedbackEnabled).
// Данные не чувствительны (только сам факт «показывать кнопку»), но, как и ingest,
// отвечаем ACAO только зарегистрированному домену — чтобы конфиг читал лишь свой сайт.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Хостнейм из заголовка Origin (без схемы и порта), либо null. */
function originHostname(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

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

async function resolveProject(req: Request) {
  const origin = req.headers.get("origin");
  const host = originHostname(origin);
  if (!origin || !host) {
    return { origin, project: null as null | { feedbackEnabled: boolean; slowMs: number } };
  }
  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: { feedbackEnabled: true, slowMs: true },
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
  return NextResponse.json(
    { feedback: project.feedbackEnabled, slowMs: project.slowMs },
    { headers: corsHeaders(origin) },
  );
}
