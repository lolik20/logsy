// Приём событий логирования от клиентского SDK.
//
// Модель безопасности (keyless): проект определяется и авторизуется ИСКЛЮЧИТЕЛЬНО по
// заголовку Origin входящего запроса — он совпадает с доменом проекта (Project.domain
// уникален). Браузер выставляет Origin сам и подделать его со стороны страницы нельзя,
// поэтому CORS-гейт = авторизация: с чужого домена ответ уходит без заголовка
// Access-Control-Allow-Origin, и браузер блокирует чтение/отправку.
//
// Исключение — сайты, проксирующие Logsy у себя: там запросы same-origin и браузер Origin
// не шлёт, поэтому источник определяется по Referer/Host (см. src/lib/logger-origin.ts).
//
// Тело батча приходит как text/plain (SDK шлёт keepalive-fetch и sendBeacon), чтобы
// запросы оставались CORS-simple и не вызывали preflight. Здесь мы всё равно парсим JSON.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/request-ip";
import { accountNewSession, truncate, isBotUserAgent, normalizeUtm, MAX_BODY_CHARS } from "@/lib/logging";
import { matchesException } from "@/lib/exceptions";
import { resolveCountry } from "@/lib/geo";
import { notifyUserReports } from "@/lib/user-report";
import { notifySessionErrors } from "@/lib/error-alert";
import { createTasksFromReports } from "@/lib/tasks";
import { resolveRequestOrigin } from "@/lib/logger-origin";

export const dynamic = "force-dynamic";

// Ограничиваем размер батча, чтобы одна отправка не могла раздуть запись.
const MAX_EVENTS_PER_BATCH = 50;

/** Достаёт почту отправителя из meta события USER_REPORT (JSON), либо null. */
function emailFromMeta(meta: string | null): string | null {
  if (!meta) return null;
  try {
    const obj = JSON.parse(meta) as { email?: unknown };
    return typeof obj.email === "string" && obj.email ? obj.email : null;
  } catch {
    return null;
  }
}

const eventSchema = z.object({
  type: z.enum([
    "ERROR",
    "UNHANDLED_REJECTION",
    "SLOW_REQUEST",
    "HTTP_ERROR",
    "SESSION_START",
    "SESSION_END",
    "NAVIGATION",
    // Уход на другой сайт: в route лежит полный адрес назначения. Переходы между
    // поддоменами одного сайта сюда не попадают — они считаются внутренними.
    "OUTBOUND",
    "CLICK",
    // Rage-клик: серия быстрых повторных кликов в одну точку (признак фрустрации —
    // элемент не отвечает). Детектируется на клиенте в SDK.
    "RAGE_CLICK",
    "INPUT",
    "USER_REPORT",
    // Метрики карты загрузки страниц: время до прогрузки конечного контента (PAGE_LOAD)
    // и медленные статические файлы — скрипты/стили/картинки/шрифты (SLOW_RESOURCE).
    "PAGE_LOAD",
    "SLOW_RESOURCE",
  ]),
  message: z.string().max(4000).optional().nullable(),
  stack: z.string().max(8000).optional().nullable(),
  url: z.string().max(2000).optional().nullable(),
  route: z.string().max(2000).optional().nullable(),
  query: z.string().max(2000).optional().nullable(),
  method: z.string().max(16).optional().nullable(),
  statusCode: z.number().int().optional().nullable(),
  durationMs: z.number().int().optional().nullable(),
  reqBody: z.string().max(8000).optional().nullable(),
  resBody: z.string().max(8000).optional().nullable(),
  // Почта отправителя обратной формы ошибок (только для событий USER_REPORT).
  email: z.string().trim().max(320).optional().nullable(),
  ts: z.number().int().optional().nullable(),
});

const batchSchema = z.object({
  sessionKey: z.string().min(1).max(128),
  userAgent: z.string().max(512).optional().nullable(),
  // Публичный IP пользователя, определённый скриптом через сторонний сервис.
  ip: z.string().max(64).optional().nullable(),
  // Метки перехода из query-строки лендинга (UTM + рекламные click id). Ключи
  // фильтруются на сервере (normalizeUtm), значения ограничиваем по длине здесь.
  utm: z.record(z.string().max(1024)).optional().nullable(),
  events: z.array(eventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});

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

/** Находит проект по домену сайта-источника. Возвращает проект и origin, если разрешён. */
async function resolveProject(req: Request) {
  const { origin, host } = resolveRequestOrigin(req);
  if (!origin || !host)
    return {
      origin,
      project: null as null | {
        id: string;
        billingStatus: string;
        currentPeriodEnd: Date | null;
        sessionsPerDay: number;
        retentionHours: number;
      },
    };
  const project = await prisma.project.findUnique({
    where: { domain: host },
    select: {
      id: true,
      billingStatus: true,
      currentPeriodEnd: true,
      sessionsPerDay: true,
      retentionHours: true,
    },
  });
  return { origin, project };
}

// Preflight. Проект ищем так же по Origin — только зарегистрированный домен получает ACAO.
export async function OPTIONS(req: Request) {
  const { origin, project } = await resolveProject(req);
  if (!origin || !project) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const { origin, project } = await resolveProject(req);
  // Домен не зарегистрирован ни в одном проекте — отклоняем без CORS-заголовка.
  if (!origin || !project) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const headers = corsHeaders(origin);

  const raw = await req.text();

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400, headers });
  }

  const parsed = batchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400, headers });
  }

  // Отсеиваем ботов (краулеры, превью-боты, headless): их «сессии» — мусор.
  // UA берём из тела батча (navigator.userAgent), а если его нет — из заголовка.
  // Не пишем сессию/события и не расходуем квоту; отвечаем 200, чтобы не провоцировать ретраи.
  const uaForBotCheck = parsed.data.userAgent ?? req.headers.get("user-agent");
  if (isBotUserAgent(uaForBotCheck)) {
    return NextResponse.json({ stored: false, reason: "bot" }, { status: 200, headers });
  }

  const { sessionKey, userAgent, ip, utm, events } = parsed.data;
  // IP от скрипта (публичный, через сторонний сервис) приоритетнее заголовков;
  // если его нет — берём из X-Forwarded-For / X-Real-IP.
  const resolvedIp = truncate(ip, 64) ?? getClientIp(req);
  // Метки перехода: оставляем только известные ключи и сериализуем в JSON.
  const utmJson = normalizeUtm(utm);

  // Квота тарифа считается по числу пользовательских сессий за сутки. Расходует квоту
  // только НОВАЯ сессия (существующая, начатая ранее, уже учтена и продолжает писаться).
  const existing = await prisma.logSession.findUnique({
    where: { projectId_sessionKey: { projectId: project.id, sessionKey } },
    select: { id: true, utm: true, country: true },
  });
  if (!existing) {
    const usage = await accountNewSession(project.id, project);
    if (usage.overQuota) {
      // Квота исчерпана — новую сессию не создаём. Отвечаем 200, чтобы SDK не ретраил.
      return NextResponse.json({ stored: false, reason: "quota" }, { status: 200, headers });
    }
  }

  // Страну по IP определяем один раз: для новой сессии или если у существующей она ещё
  // не сохранена (best-effort, не блокирует запись — при ошибке остаётся null).
  const country =
    !existing || !existing.country ? await resolveCountry(resolvedIp) : null;

  // Апсертим сессию (обновляем lastSeenAt и IP), затем пишем события пачкой.
  // Метки перехода фиксируем по first-touch: пишем при создании сессии, а если метки
  // ещё не сохранены и текущий переход их принёс — дозаписываем. Уже сохранённые метки
  // не перезаписываем (чтобы вернувшийся пользователь не «переклеился» на новую кампанию).
  const session = await prisma.logSession.upsert({
    where: { projectId_sessionKey: { projectId: project.id, sessionKey } },
    create: {
      projectId: project.id,
      sessionKey,
      userAgent: truncate(userAgent, 512),
      ip: resolvedIp,
      country,
      utm: utmJson,
      lastSeenAt: new Date(),
    },
    update: {
      lastSeenAt: new Date(),
      ip: resolvedIp,
      ...(existing && !existing.country && country ? { country } : {}),
      ...(existing && !existing.utm && utmJson ? { utm: utmJson } : {}),
    },
    select: { id: true },
  });

  // Игнор-лист проекта: события, подходящие под любое правило-исключение (категория
  // события + условие по URL), не сохраняем. См. matchesException в src/lib/exceptions.ts.
  const exceptions = await prisma.logException.findMany({
    where: { projectId: project.id },
    select: { kind: true, urlMode: true, url: true },
  });

  const rows = events
    .map((e) => ({
      projectId: project.id,
      sessionId: session.id,
      type: e.type,
      message: truncate(e.message),
      stack: truncate(e.stack, 8000),
      url: truncate(e.url, 2000),
      route: truncate(e.route, 2000),
      query: truncate(e.query, 2000),
      method: e.method ?? null,
      statusCode: e.statusCode ?? null,
      durationMs: e.durationMs ?? null,
      reqBody: truncate(e.reqBody, MAX_BODY_CHARS),
      resBody: truncate(e.resBody, MAX_BODY_CHARS),
      // Для сообщений обратной формы храним почту отправителя в meta (JSON).
      meta:
        e.type === "USER_REPORT" && e.email
          ? JSON.stringify({ email: truncate(e.email, 320) })
          : null,
      createdAt: e.ts ? new Date(e.ts) : undefined,
    }))
    .filter((row) => !exceptions.some((rule) => matchesException(row, rule)));

  if (rows.length) {
    await prisma.logEvent.createMany({ data: rows });
  }

  // Обратная форма ошибок: по каждому сообщению пользователя (USER_REPORT) заводим
  // задачу в статусе «Создано» и уведомляем владельца проекта на его контакты.
  const reports = rows
    .filter((r) => r.type === "USER_REPORT")
    .map((r) => ({ message: r.message, url: r.url, email: emailFromMeta(r.meta) }));
  if (reports.length) {
    // Задачи создаём надёжно (await): это основной результат репорта. Уведомлению передаём
    // результат с id задач: ответ владельца из Telegram попадёт в переписку своей задачи.
    const handled = await createTasksFromReports(project.id, session.id, reports).catch((err) => {
      console.error("[Logsy] Ошибка создания задачи из сообщения пользователя:", err);
      return reports.map((r) => ({ ...r, taskId: null }));
    });
    // Уведомления шлём в фоне (best-effort), чтобы не задерживать ответ SDK; в
    // долгоживущем процессе промис доедет до конца.
    void notifyUserReports(project.id, session.id, handled).catch((err) =>
      console.error("[Logsy] Ошибка уведомления о сообщении пользователя:", err),
    );
  }

  // Уведомление об ошибках в сессиях (только ERROR / UNHANDLED_REJECTION / HTTP_ERROR),
  // не чаще раза в час на проект — троттлинг внутри notifySessionErrors. Шлём в фоне
  // (best-effort), как и уведомления о сообщениях пользователей.
  const errorEvents = rows
    .filter((r) => r.type === "ERROR" || r.type === "UNHANDLED_REJECTION" || r.type === "HTTP_ERROR")
    .map((r) => ({
      type: r.type,
      message: r.message,
      url: r.url,
      route: r.route,
      query: r.query,
      method: r.method,
      statusCode: r.statusCode,
      durationMs: r.durationMs,
      reqBody: r.reqBody,
      resBody: r.resBody,
      stack: r.stack,
    }));
  if (errorEvents.length) {
    void notifySessionErrors(project.id, session.id, errorEvents).catch((err) =>
      console.error("[Logsy] Ошибка уведомления об ошибках в сессии:", err),
    );
  }

  return NextResponse.json({ stored: true, count: rows.length }, { status: 200, headers });
}
