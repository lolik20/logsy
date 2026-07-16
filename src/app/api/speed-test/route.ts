import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Публичный онлайн-инструмент: измеряет скорость загрузки сайта «как в браузере»,
// но без headless-браузера. Загружаем HTML, находим все подключённые скрипты,
// стили и картинки и параллельно скачиваем их — как это делает браузер при
// построении страницы. Ключевая метрика — готовность DOM: HTML разобран и все
// скрипты загружены. Каждый прогон сохраняется для админ-статистики
// (домен, время прогона, скорость) — личных данных не пишем.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 45;

const schema = z.object({
  url: z.string().min(1, "Укажите адрес сайта").max(2000),
});

const DOC_TIMEOUT_MS = 20_000;
const RES_TIMEOUT_MS = 15_000;
const MAX_RESOURCES = 80; // не скачиваем больше — защита от «тяжёлых» страниц
const MAX_RES_BYTES = 8 * 1024 * 1024; // лимит на один ресурс
const MAX_TOTAL_BYTES = 60 * 1024 * 1024; // общий лимит трафика
const CONCURRENCY = 12; // параллельных загрузок, как у браузера
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 LogsySpeedTest/1.0";

/** Хост указывает на локальную/приватную сеть? (защита от SSRF). */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    h === "::1" ||
    h.startsWith("[")
  );
}

/**
 * Приводит введённый адрес к корректному URL (добавляет https://, если схемы
 * нет). Возвращает null для некорректных или внутренних адресов.
 */
function normalizeUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;
  return url;
}

type ResKind = "script" | "style" | "image";
interface ResRef {
  url: string;
  kind: ResKind;
}

/** Извлекает из HTML ссылки на скрипты, стили и картинки, приводя их к абсолютным. */
function extractResources(html: string, baseUrl: URL): ResRef[] {
  // Учитываем <base href>, если он задан.
  let base = baseUrl;
  const baseTag = /<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(html);
  if (baseTag) {
    try {
      base = new URL(baseTag[1], baseUrl);
    } catch {
      /* игнорируем некорректный base */
    }
  }

  const found = new Map<string, ResKind>();
  const add = (raw: string, kind: ResKind) => {
    const href = raw.trim();
    if (!href || href.startsWith("data:") || href.startsWith("javascript:")) return;
    try {
      const abs = new URL(href, base);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      if (isBlockedHost(abs.hostname)) return;
      // Скрипт важнее для готовности DOM — не понижаем его до картинки/стиля.
      const prev = found.get(abs.href);
      if (!prev || (prev !== "script" && kind === "script")) found.set(abs.href, kind);
    } catch {
      /* некорректная ссылка — пропускаем */
    }
  };

  // <script src="...">
  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(m[1], "script");
  }
  // <link rel="stylesheet" href="..."> (rel и href в любом порядке)
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (href) add(href[1], "style");
  }
  // <img src="...">
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(m[1], "image");
  }

  return Array.from(found, ([url, kind]) => ({ url, kind })).slice(0, MAX_RESOURCES);
}

interface FetchTiming {
  ok: boolean;
  bytes: number;
  finishedAtMs: number; // время завершения относительно общего старта
}

/** Скачивает один ресурс и засекает, когда он полностью загрузился. */
async function fetchResource(
  url: string,
  start: number,
  budget: { total: number },
): Promise<FetchTiming> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RES_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": UA, accept: "*/*" },
    });
    let bytes = 0;
    const reader = res.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          bytes += value.byteLength;
          budget.total += value.byteLength;
          if (bytes > MAX_RES_BYTES || budget.total > MAX_TOTAL_BYTES) {
            await reader.cancel().catch(() => {});
            break;
          }
        }
      }
    }
    return { ok: res.ok, bytes, finishedAtMs: Date.now() - start };
  } catch {
    return { ok: false, bytes: 0, finishedAtMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

/** Выполняет задачи с ограничением параллельности (как пул соединений браузера). */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let i = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx]);
    }
  });
  await Promise.all(runners);
}

interface SpeedResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  requests: number;
  transferBytes: number;
  redirected: boolean;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const url = normalizeUrl(parsed.data.url);
  if (!url) {
    return NextResponse.json(
      { error: "Некорректный или недопустимый адрес сайта" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const docTimer = setTimeout(() => controller.abort(), DOC_TIMEOUT_MS);
  const start = Date.now();

  try {
    // 1. Загружаем HTML-документ, засекаем первый байт и полную загрузку HTML.
    const res = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const ttfbMs = Date.now() - start; // заголовки получены
    const html = await res.text();
    const htmlDoneMs = Date.now() - start;
    clearTimeout(docTimer);

    const budget = { total: Buffer.byteLength(html) };

    // 2. Находим подресурсы и параллельно скачиваем их — как браузер при разборе.
    const resources = extractResources(html, new URL(res.url || url.toString()));
    const scriptFinish: number[] = [];
    const anyFinish: number[] = [];
    let ok = 0;

    await runPool(resources, CONCURRENCY, async (r) => {
      const t = await fetchResource(r.url, start, budget);
      if (t.ok) ok += 1;
      anyFinish.push(t.finishedAtMs);
      if (r.kind === "script") scriptFinish.push(t.finishedAtMs);
    });

    // 3. Оцениваем метрики.
    // Готовность DOM ≈ HTML разобран + все скрипты загружены (скрипты блокируют
    // DOMContentLoaded). Полная загрузка ≈ когда пришёл последний ресурс.
    const domContentLoadedMs = Math.max(htmlDoneMs, ...scriptFinish, 0);
    const loadMs = Math.max(htmlDoneMs, ...anyFinish, 0);

    const finalUrl = res.url || url.toString();
    const result: SpeedResult = {
      url: url.toString(),
      finalUrl,
      statusCode: res.status,
      ttfbMs,
      domContentLoadedMs,
      loadMs,
      requests: 1 + resources.length,
      transferBytes: budget.total,
      redirected: finalUrl.replace(/\/$/, "") !== url.toString().replace(/\/$/, ""),
    };

    // Сохраняем прогон для админ-статистики. Ошибка записи не должна ломать ответ.
    try {
      let domain = url.hostname;
      try {
        domain = new URL(finalUrl).hostname;
      } catch {
        /* оставляем исходный hostname */
      }
      await prisma.speedCheck.create({
        data: {
          domain,
          url: finalUrl,
          statusCode: result.statusCode,
          ttfbMs: result.ttfbMs,
          domContentLoadedMs: result.domContentLoadedMs,
          loadMs: result.loadMs,
          requests: result.requests,
          transferBytes: result.transferBytes,
        },
      });
    } catch {
      /* запись статистики необязательна */
    }

    return NextResponse.json(result);
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const message = isTimeout
      ? `Сайт не ответил за ${DOC_TIMEOUT_MS / 1000} секунд — вероятно, он слишком медленный`
      : err instanceof Error
        ? `Не удалось загрузить сайт: ${err.message}`
        : "Не удалось загрузить сайт";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(docTimer);
  }
}
