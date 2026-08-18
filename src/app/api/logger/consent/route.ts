// Приём согласий от клиентского SDK: посетитель поставил галочку в форме сайта проекта.
//
// Модель безопасности та же, что у /api/logger/ingest — keyless по Origin: проект
// определяется по домену, с которого пришёл запрос (Project.domain уникален), а CORS-гейт
// работает как авторизация. Тело шлём как text/plain, чтобы запрос оставался CORS-simple
// и не требовал preflight.
//
// Зачем это нужно. Сама по себе галочка на сайте юридической силы не имеет: при проверке
// доказывать нужно факт согласия конкретного человека (ч. 1 ст. 9 152-ФЗ). Поэтому здесь
// записывается момент, страница, форма, версии документов и IP — то есть доказательство.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { resolveRequestOrigin } from "@/lib/logger-origin";
import { currentDocVersions } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Заголовки CORS для разрешённого origin (эхо конкретного домена, не "*"). */
function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}

const schema = z.object({
  // PD — обработка персональных данных, MARKETING — рекламная рассылка, COOKIE — плашка.
  kind: z.enum(["PD", "MARKETING", "COOKIE"]).default("PD"),
  page: z.string().max(2000),
  formAction: z.string().max(2000).nullish(),
  sessionKey: z.string().max(200).nullish(),
  // Текст, который стоял рядом с галочкой — снимок формулировки на момент согласия.
  text: z.string().max(1000).nullish(),
});

export async function OPTIONS(req: Request) {
  const { origin, host } = resolveRequestOrigin(req);
  if (!origin || !host) return new NextResponse(null, { status: 403 });
  const project = await prisma.project.findUnique({ where: { domain: host }, select: { id: true } });
  if (!project) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const { origin, host } = resolveRequestOrigin(req);
  if (!origin || !host) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: { id: true, consentEnabled: true },
  });
  if (!project) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Тело приходит как text/plain (CORS-simple), поэтому парсим JSON сами.
  const raw = await req.text().catch(() => "");
  let body: unknown = null;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "bad request" }, { status: 400, headers: corsHeaders(origin) });
  }

  const versions = await currentDocVersions(project.id);
  await prisma.consent.create({
    data: {
      projectId: project.id,
      kind: parsed.data.kind,
      page: parsed.data.page,
      formAction: parsed.data.formAction ?? null,
      sessionKey: parsed.data.sessionKey ?? null,
      text: parsed.data.text ?? null,
      docs: JSON.stringify(versions),
      ip: getClientIp(req),
      userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    },
  });

  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
