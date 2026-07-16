import { NextResponse } from "next/server";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser } from "playwright-core";

// Публичный онлайн-инструмент: открывает указанный URL в реальном headless-браузере
// (Chromium) и измеряет скорость загрузки страницы «как у пользователя» — с
// выполнением всех скриптов. Ключевая метрика — время до готовности DOM
// (DOMContentLoaded, включая синхронные и defer-скрипты). Ничего не сохраняем.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Загрузка страницы в браузере может занять время — поднимаем лимит функции.
export const maxDuration = 60;

const schema = z.object({
  url: z.string().min(1, "Укажите адрес сайта").max(2000),
});

const NAV_TIMEOUT_MS = 35_000;

/**
 * Приводит введённый пользователем адрес к корректному URL: добавляет схему
 * https://, если пользователь её не указал. Возвращает null, если адрес
 * некорректен или указывает на локальный/приватный хост (защита от SSRF).
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

  const host = url.hostname.toLowerCase();
  // Блокируем обращения к внутренним адресам — эндпоинт публичный.
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "::1" ||
    host.startsWith("[")
  ) {
    return null;
  }

  return url;
}

/**
 * Ищет исполняемый файл Chromium. Приоритет — переменная окружения; иначе
 * перебираем сборки в PLAYWRIGHT_BROWSERS_PATH. undefined — пусть playwright
 * подберёт браузер по умолчанию.
 */
function findChromiumExecutable(): string | undefined {
  const explicit = process.env.CHROMIUM_EXECUTABLE_PATH;
  if (explicit && fs.existsSync(explicit)) return explicit;

  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base) {
    try {
      const dirs = fs
        .readdirSync(base)
        .filter((d) => d.startsWith("chromium-") && !d.includes("headless_shell"))
        .sort()
        .reverse();
      for (const d of dirs) {
        const p = path.join(base, d, "chrome-linux", "chrome");
        if (fs.existsSync(p)) return p;
      }
    } catch {
      // каталог недоступен — используем дефолт playwright
    }
  }
  return undefined;
}

interface SpeedResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number | null;
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

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      executablePath: findChromiumExecutable(),
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 LogsySpeedTest/1.0",
      viewport: { width: 1366, height: 768 },
    });
    const page = await context.newPage();

    // Считаем сетевые запросы и приблизительный объём переданных данных.
    let requests = 0;
    let transferBytes = 0;
    page.on("response", (resp) => {
      requests += 1;
      const cl = resp.headers()["content-length"];
      if (cl) transferBytes += Number.parseInt(cl, 10) || 0;
    });

    // Ждём готовности DOM (все синхронные и defer-скрипты выполнены).
    const response = await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    // Пытаемся дождаться полной загрузки (load) для второй метрики, но не
    // проваливаем проверку, если тяжёлые ресурсы не успели за короткий срок.
    await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});

    // Снимаем метрики из Navigation Timing — они точнее «ручного» таймера.
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;
      return {
        ttfb: nav.responseStart,
        domContentLoaded: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
      };
    });

    const finalUrl = page.url();
    const statusCode = response?.status() ?? 0;

    const result: SpeedResult = {
      url: url.toString(),
      finalUrl,
      statusCode,
      ttfbMs: Math.max(0, Math.round(timing?.ttfb ?? 0)),
      domContentLoadedMs: Math.max(0, Math.round(timing?.domContentLoaded ?? 0)),
      loadMs:
        timing && timing.load > 0 ? Math.max(0, Math.round(timing.load)) : null,
      requests,
      transferBytes,
      redirected: finalUrl.replace(/\/$/, "") !== url.toString().replace(/\/$/, ""),
    };

    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const isTimeout = /Timeout|timed out|exceeded/i.test(raw);
    const message = isTimeout
      ? "Сайт не успел загрузиться за отведённое время — вероятно, он слишком медленный"
      : `Не удалось открыть сайт: ${raw || "неизвестная ошибка"}`;
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    await browser?.close().catch(() => {});
  }
}
