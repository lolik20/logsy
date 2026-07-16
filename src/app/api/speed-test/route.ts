import { NextResponse } from "next/server";
import { z } from "zod";

// Публичный онлайн-инструмент: делает один GET-запрос к указанному URL и
// измеряет скорость загрузки — время до первого байта (TTFB), полное время
// загрузки ответа, размер и HTTP-статус. Никаких данных не сохраняем.
export const dynamic = "force-dynamic";

const schema = z.object({
  url: z.string().min(1, "Укажите адрес сайта").max(2000),
});

const TIMEOUT_MS = 20_000;
const MAX_BYTES = 25 * 1024 * 1024; // 25 МБ — защита от бесконечной загрузки

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

interface SpeedResult {
  url: string;
  statusCode: number;
  ttfbMs: number;
  totalMs: number;
  sizeBytes: number;
  redirected: boolean;
  finalUrl: string;
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
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "LogsySpeedTest/1.0 (+https://logsy.ru)",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    // Время до первого байта — момент, когда получены заголовки ответа.
    const ttfbMs = Date.now() - start;

    // Дочитываем тело до конца, чтобы измерить полное время загрузки и размер.
    let sizeBytes = 0;
    const reader = res.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          sizeBytes += value.byteLength;
          if (sizeBytes > MAX_BYTES) {
            await reader.cancel().catch(() => {});
            break;
          }
        }
      }
    }

    const totalMs = Date.now() - start;

    const result: SpeedResult = {
      url: url.toString(),
      statusCode: res.status,
      ttfbMs,
      totalMs,
      sizeBytes,
      redirected: res.redirected,
      finalUrl: res.url || url.toString(),
    };

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Сайт не ответил за ${TIMEOUT_MS / 1000} секунд — превышено время ожидания`
        : err instanceof Error
          ? `Не удалось загрузить сайт: ${err.message}`
          : "Не удалось загрузить сайт";
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
