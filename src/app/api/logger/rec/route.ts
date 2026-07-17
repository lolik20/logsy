// Приём записи экрана сессии (rrweb) от клиентского SDK.
//
// Модель безопасности — та же keyless-схема, что и в /api/logger/ingest: проект
// определяется и авторизуется ИСКЛЮЧИТЕЛЬНО по заголовку Origin (домен проекта уникален),
// ответ получает ACAO только зарегистрированный домен. Тело приходит как text/plain
// (SDK шлёт keepalive-fetch/sendBeacon), поэтому запрос остаётся CORS-simple без preflight.
//
// Клиентский рекордер (см. /public/logsy-rec.js — vendored rrweb) эмитит поток событий:
// полный DOM-снимок и инкрементальные мутации. SDK копит их и батчами шлёт сюда чанками.
// Каждый чанк сохраняется одной строкой RecordingChunk с JSON-массивом событий rrweb.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { accountNewSession, truncate, isBotUserAgent } from "@/lib/logging";

export const dynamic = "force-dynamic";

// Ограничения на размер одного батча записи. Полный DOM-снимок бывает крупным, поэтому
// лимит на объём чанка щедрый, но конечный — чтобы одна отправка не раздула хранилище.
const MAX_CHUNKS_PER_BATCH = 20;
const MAX_EVENTS_PER_CHUNK = 500;
const MAX_DATA_CHARS = 5_000_000; // ~5 МБ на сериализованный чанк (обычно много меньше)

// Событие rrweb: нам важны только type и timestamp (для порядка воспроизведения),
// остальные поля пробрасываем как есть (passthrough) — плеер разберёт их сам.
const rrwebEventSchema = z
  .object({ type: z.number().int(), timestamp: z.number() })
  .passthrough();

const batchSchema = z.object({
  sessionKey: z.string().min(1).max(128),
  userAgent: z.string().max(512).optional().nullable(),
  chunks: z
    .array(
      z.object({
        seq: z.number().int().min(0),
        events: z.array(rrwebEventSchema).min(1).max(MAX_EVENTS_PER_CHUNK),
      }),
    )
    .min(1)
    .max(MAX_CHUNKS_PER_BATCH),
});

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
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };
}

/** Находит проект по домену из Origin (только с включённой записью экрана). */
async function resolveProject(req: Request) {
  const origin = req.headers.get("origin");
  const host = originHostname(origin);
  if (!origin || !host) {
    return { origin, project: null as null | { id: string; tier: string | null; recordSession: boolean } };
  }
  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: { id: true, tier: true, recordSession: true },
  });
  return { origin, project };
}

export async function OPTIONS(req: Request) {
  const { origin, project } = await resolveProject(req);
  if (!origin || !project) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const { origin, project } = await resolveProject(req);
  if (!origin || !project) {
    // Частая причина «запись не пишется»: домен сайта не совпадает с Project.domain,
    // либо запрос пришёл без заголовка Origin. Логируем, чтобы это было видно.
    console.warn(
      `[logsy/rec] отклонено 403: проект не определён по Origin` +
        ` (origin=${origin ?? "—"}, host=${originHostname(origin) ?? "—"}).` +
        ` Проверьте, что домен сайта совпадает с Project.domain.`,
    );
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const headers = corsHeaders(origin);

  // Запись выключена для проекта — молча принимаем (200), чтобы SDK не ретраил.
  // (SDK не должен слать сюда с выключенной записью, но подстраховываемся.)
  if (!project.recordSession) {
    console.warn(
      `[logsy/rec] чанк отброшен: запись экрана выключена для проекта ${project.id}` +
        ` (recordSession=false). Включите запись в настройках проекта.`,
    );
    return NextResponse.json({ stored: false, reason: "disabled" }, { status: 200, headers });
  }

  const raw = await req.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    console.warn(
      `[logsy/rec] отклонено 400 (проект ${project.id}): тело не является JSON` +
        ` (длина=${raw.length}).`,
    );
    return NextResponse.json({ error: "bad json" }, { status: 400, headers });
  }

  const parsed = batchSchema.safeParse(json);
  if (!parsed.success) {
    // Раньше причина «invalid payload» была скрыта — при рассинхроне формата чанка с
    // клиентом это выглядело как «запись молча не пишется». Логируем детали валидации.
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    console.warn(`[logsy/rec] отклонено 400 (проект ${project.id}): невалидный payload — ${issues}`);
    return NextResponse.json({ error: "invalid payload", issues }, { status: 400, headers });
  }

  const { sessionKey, userAgent, chunks } = parsed.data;

  // Ботов не записываем: их «сессии» — мусор (та же логика, что в ingest).
  const uaForBotCheck = userAgent ?? req.headers.get("user-agent");
  if (isBotUserAgent(uaForBotCheck)) {
    console.warn(
      `[logsy/rec] чанк отброшен: запрос распознан как бот` +
        ` (проект ${project.id}, ua=${truncate(uaForBotCheck, 120)}).`,
    );
    return NextResponse.json({ stored: false, reason: "bot" }, { status: 200, headers });
  }

  // Привязываем запись к пользовательской сессии (та же по projectId+sessionKey, что и в
  // логах). Если её ещё нет — создаём, расходуя суточную квоту тарифа так же, как ingest,
  // чтобы записью нельзя было обойти учёт сессий.
  let session = await prisma.logSession.findUnique({
    where: { projectId_sessionKey: { projectId: project.id, sessionKey } },
    select: { id: true },
  });
  if (!session) {
    const usage = await accountNewSession(project.id, project.tier);
    if (usage.overQuota) {
      console.warn(
        `[logsy/rec] чанк отброшен: превышена суточная квота сессий проекта ${project.id}` +
          ` (использовано ${usage.totalSessions}). Запись новых сессий приостановлена до конца суток.`,
      );
      return NextResponse.json({ stored: false, reason: "quota" }, { status: 200, headers });
    }
    session = await prisma.logSession.upsert({
      where: { projectId_sessionKey: { projectId: project.id, sessionKey } },
      create: {
        projectId: project.id,
        sessionKey,
        userAgent: truncate(userAgent, 512),
        lastSeenAt: new Date(),
      },
      update: { lastSeenAt: new Date() },
      select: { id: true },
    });
  } else {
    await prisma.logSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    });
  }

  const rows = chunks
    .map((c) => {
      const data = JSON.stringify(c.events);
      return {
        projectId: project.id,
        sessionId: session!.id,
        seq: c.seq,
        data,
        events: c.events.length,
      };
    })
    // Отбрасываем аномально большие чанки, чтобы не раздуть хранилище.
    .filter((r) => r.data.length <= MAX_DATA_CHARS);

  const dropped = chunks.length - rows.length;
  if (dropped > 0) {
    console.warn(
      `[logsy/rec] проект ${project.id}, сессия ${session!.id}: отброшено ${dropped} из` +
        ` ${chunks.length} чанков — превышен лимит размера ${MAX_DATA_CHARS} символов на чанк.`,
    );
  }

  if (rows.length) {
    await prisma.recordingChunk.createMany({ data: rows });
  }

  console.log(
    `[logsy/rec] проект ${project.id}, сессия ${session!.id}: сохранено ${rows.length} чанк(ов)` +
      ` (событий: ${rows.reduce((n, r) => n + r.events, 0)}).`,
  );

  return NextResponse.json({ stored: true, chunks: rows.length }, { status: 200, headers });
}
