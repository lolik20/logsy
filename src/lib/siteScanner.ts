// Сканер сайта для админ-инструмента «Обход». По одному URL бот «как браузер» обходит
// сайт: грузит стартовую страницу, идёт по внутренним ссылкам (BFS в пределах хоста),
// на каждой странице находит подключённые ресурсы (скрипты, стили, картинки, шрифты) и
// параллельно скачивает их — ровно так браузер строит страницу. По ходу обхода собирает:
//   • ошибки бэкенда — ответы с кодом >= 400 и сетевые сбои (страниц и ресурсов);
//   • медленные запросы — всё, что грузилось дольше порога;
//   • статику — подключённые файлы (js/css/img/шрифты) с размером и временем;
//   • почты и телефоны, найденные в разметке (mailto:/tel: и в тексте).
// Итог — единый JSON-отчёт по сайту.
//
// Реального headless-браузера в рантайме нет (как и в /api/speed-test) — он тянет за собой
// Chromium и ломает serverless/лёгкий деплой. Поэтому «обход как браузер» реализован на
// fetch: тот же UA, те же под-ресурсы и параллельная загрузка. HTML разбираем регэкспами —
// DOM-парсера в рантайме нет, а нам нужны только ссылки, ресурсы, mailto/tel и текст.

// --- Пределы обхода (чтобы не подвесить запрос на крупном сайте) ---
const MAX_PAGES = 25; // сколько HTML-страниц максимум обойти
const MAX_DEPTH = 4; // максимальная глубина вложенности пути от корня
const MAX_RESOURCES = 200; // сколько уникальных под-ресурсов максимум проверить
const PAGE_TIMEOUT_MS = 12_000; // таймаут загрузки одной страницы
const RES_TIMEOUT_MS = 12_000; // таймаут загрузки одного ресурса
const TOTAL_BUDGET_MS = 50_000; // общий бюджет обхода (route maxDuration = 60)
const CONCURRENCY = 10; // параллельных загрузок, как пул соединений браузера
const SLOW_MS = 1000; // порог «медленного» запроса (как slowMs проекта по умолчанию)
const MAX_RES_BYTES = 10 * 1024 * 1024; // лимит на один ресурс
const MAX_TOTAL_BYTES = 80 * 1024 * 1024; // общий лимит трафика

// Ограничения на размер отчёта — чтобы длинные списки не раздували ответ.
const MAX_LIST = 100; // максимум записей в списках ошибок/медленных/почт/телефонов
const MAX_ASSETS_LIST = 200; // максимум записей в списке статики

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36 LogsyBot/1.0";

// Расширения статических файлов (совпадает по смыслу с STATIC_ASSET_EXT в staticAssets.ts).
const IMG_EXT = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;
const FONT_EXT = /\.(?:woff2?|ttf|otf|eot)$/i;
const SCRIPT_EXT = /\.(?:js|mjs|cjs)$/i;
const STYLE_EXT = /\.css$/i;
const ASSET_EXT_ANY =
  /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|map|wasm)$/i;

export type AssetKind = "script" | "style" | "image" | "font" | "other";

/** Ошибка запроса: ответ >= 400 или сетевой сбой (для страницы или ресурса). */
export interface ScanError {
  url: string; // адрес запроса
  status: number; // HTTP-код (0 — сетевой сбой/таймаут)
  kind: "server" | "client" | "network"; // 5xx | 4xx | сбой соединения
  on: string; // на какой странице встретился (или сам URL — для стартовой)
}

/** Медленный запрос: страница или ресурс, загрузка дольше порога. */
export interface ScanSlow {
  url: string;
  ms: number;
  kind: "page" | AssetKind;
}

/** Статический файл, подключённый на страницах сайта. */
export interface ScanAsset {
  url: string;
  kind: AssetKind;
  status: number;
  ms: number;
  bytes: number;
}

/** Итоговый отчёт по сайту. */
export interface ScanReport {
  startUrl: string;
  finalUrl: string;
  domain: string;
  statusCode: number; // код ответа стартовой страницы
  pagesCrawled: number; // сколько HTML-страниц обошли
  requestsTotal: number; // всего сетевых запросов (страницы + ресурсы)
  transferBytes: number; // суммарный трафик ресурсов
  durationMs: number; // сколько занял обход
  stopped: "done" | "pages" | "resources" | "budget"; // причина остановки обхода
  backendErrors: ScanError[];
  slowRequests: ScanSlow[];
  staticAssets: ScanAsset[];
  emails: string[];
  phones: string[];
  summary: {
    errors: number;
    slow: number;
    assets: number;
    emails: number;
    phones: number;
    avgPageMs: number; // среднее время загрузки HTML-страниц
  };
}

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

/** Приводит введённый адрес к URL (добавляет https://). null — некорректный/внутренний. */
export function normalizeScanUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isBlockedHost(url.hostname)) return null;
  url.hash = "";
  return url;
}

/** Тип статического файла по расширению пути. */
function assetKind(pathname: string): AssetKind {
  if (SCRIPT_EXT.test(pathname)) return "script";
  if (STYLE_EXT.test(pathname)) return "style";
  if (IMG_EXT.test(pathname)) return "image";
  if (FONT_EXT.test(pathname)) return "font";
  return "other";
}

/** Достаёт значения href всех <a> из HTML. */
function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[2] ?? m[3] ?? m[4] ?? "";
    if (href) out.push(href);
  }
  return out;
}

/** Извлекает из HTML подключённые ресурсы (скрипты, стили, картинки), делая их абсолютными. */
function extractResources(html: string, baseUrl: URL): { url: string; kind: AssetKind }[] {
  let base = baseUrl;
  const baseTag = /<base\b[^>]*\bhref\s*=\s*["']([^"']+)["']/i.exec(html);
  if (baseTag) {
    try {
      base = new URL(baseTag[1], baseUrl);
    } catch {
      /* игнорируем некорректный base */
    }
  }

  const found = new Map<string, AssetKind>();
  const add = (raw: string, kind: AssetKind) => {
    const href = raw.trim();
    if (!href || href.startsWith("data:") || href.startsWith("javascript:")) return;
    try {
      const abs = new URL(href, base);
      if (abs.protocol !== "http:" && abs.protocol !== "https:") return;
      if (isBlockedHost(abs.hostname)) return;
      abs.hash = "";
      // Уточняем тип по расширению, если тег дал общий («other»/«style»-подобный).
      const byExt = assetKind(abs.pathname);
      const finalKind = kind === "other" && byExt !== "other" ? byExt : kind;
      const prev = found.get(abs.href);
      // Скрипт важнее — не понижаем его до стиля/картинки.
      if (!prev || (prev !== "script" && finalKind === "script")) found.set(abs.href, finalKind);
    } catch {
      /* некорректная ссылка — пропускаем */
    }
  };

  for (const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(m[1], "script");
  }
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
    if (!href) continue;
    if (/\brel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) add(href[1], "style");
    else if (/\bas\s*=\s*["']?font/i.test(tag) || FONT_EXT.test(href[1])) add(href[1], "font");
    else if (/\brel\s*=\s*["']?(?:icon|apple-touch-icon)/i.test(tag)) add(href[1], "image");
  }
  for (const m of html.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(m[1], "image");
  }

  return Array.from(found, ([url, kind]) => ({ url, kind }));
}

/** Нормализует внутреннюю ссылку в путь того же хоста или null (внешняя/ресурс/некорректная). */
function internalPath(href: string, pageUrl: string, host: string): string | null {
  const raw = href.trim();
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (
    low.startsWith("#") ||
    low.startsWith("mailto:") ||
    low.startsWith("tel:") ||
    low.startsWith("javascript:") ||
    low.startsWith("data:")
  ) {
    return null;
  }
  let u: URL;
  try {
    u = new URL(raw, pageUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.hostname.toLowerCase() !== host) return null;
  if (ASSET_EXT_ANY.test(u.pathname)) return null; // это файл, не страница
  // Путь без завершающего слэша (кроме корня); query отбрасываем.
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  return path;
}

function pathDepth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

// --- Извлечение почт и телефонов ---

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)+/g;

/** Похоже на почту, а не на кусок имени файла/версии (foo@2x.png, sprite@2x)? */
function looksLikeEmail(addr: string): boolean {
  const at = addr.lastIndexOf("@");
  if (at < 1) return false;
  const domain = addr.slice(at + 1);
  if (!domain.includes(".")) return false;
  const tld = domain.slice(domain.lastIndexOf(".") + 1).toLowerCase();
  if (tld.length < 2 || /\d/.test(tld)) return false; // TLD не бывает с цифрами
  if (ASSET_EXT_ANY.test("." + tld) || tld === "png" || tld === "jpg") return false;
  if (/@\dx/i.test(addr)) return false; // ретина-суффиксы @2x/@3x
  return true;
}

/** Собирает почты из mailto:-ссылок и из текста HTML. */
function extractEmails(html: string, into: Set<string>) {
  for (const m of html.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    const addr = decodeURIComponent(m[1]).trim().toLowerCase();
    if (looksLikeEmail(addr)) into.add(addr);
  }
  for (const m of html.matchAll(EMAIL_RE)) {
    const addr = m[0].trim().toLowerCase();
    if (looksLikeEmail(addr)) into.add(addr);
  }
}

/** Нормализует российский номер к виду +7XXXXXXXXXX или null, если не похоже на телефон. */
function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[^\d+]/g, "");
  const plus = digits.startsWith("+");
  digits = digits.replace(/\D/g, "");
  // Российский формат: 11 цифр, начинается с 7 или 8 → +7XXXXXXXXXX.
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    return "+7" + digits.slice(1);
  }
  // 10 цифр без кода страны — считаем российским мобильным/городским.
  if (digits.length === 10 && !plus) {
    return "+7" + digits;
  }
  // Международный с «+» и разумной длиной — оставляем как есть.
  if (plus && digits.length >= 8 && digits.length <= 15) {
    return "+" + digits;
  }
  return null;
}

/** Собирает телефоны из tel:-ссылок и из текста HTML. */
function extractPhones(html: string, into: Set<string>) {
  // Значение tel: может содержать пробелы/скобки (tel:+7 (495) 123-45-67) — берём его
  // целиком до закрывающей кавычки/угла, а нормализация уже выкинет лишние символы.
  for (const m of html.matchAll(/tel:([^"'<>]+)/gi)) {
    const norm = normalizePhone(decodeURIComponent(m[1].trim()));
    if (norm) into.add(norm);
  }
  // Убираем теги, чтобы не ловить цифры из атрибутов/скриптов, и ищем в тексте.
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const re = /(?:\+7|8|7)[\s\-()]*\d{3}[\s\-()]*\d{3}[\s\-()]*\d{2}[\s\-()]*\d{2}/g;
  for (const m of text.matchAll(re)) {
    const norm = normalizePhone(m[0]);
    if (norm) into.add(norm);
  }
}

interface FetchOutcome {
  status: number; // 0 — сетевой сбой/таймаут
  ms: number;
  bytes: number;
  contentType: string;
  finalUrl: string;
  body?: string; // текст — только для HTML-страниц
}

/** Загружает URL, засекая время и размер. wantHtml=true — читаем и возвращаем текст HTML. */
async function fetchUrl(
  url: string,
  wantHtml: boolean,
  budget: { total: number },
  timeoutMs: number,
): Promise<FetchOutcome> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "user-agent": UA,
        accept: wantHtml
          ? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          : "*/*",
      },
    });
    const contentType = res.headers.get("content-type") ?? "";
    let bytes = 0;
    let body: string | undefined;

    if (wantHtml && contentType.includes("text/html")) {
      const text = await res.text();
      bytes = Buffer.byteLength(text);
      budget.total += bytes;
      body = text;
    } else {
      // Считаем размер потоково, не держа тело в памяти целиком.
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
    }
    return {
      status: res.status,
      ms: Date.now() - start,
      bytes,
      contentType,
      finalUrl: res.url || url,
      body,
    };
  } catch {
    return { status: 0, ms: Date.now() - start, bytes: 0, contentType: "", finalUrl: url };
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

/**
 * Обходит сайт по стартовому URL и формирует отчёт: ошибки бэкенда, медленные запросы,
 * статика, найденные почты и телефоны. Кидает ошибку, если стартовая страница недоступна.
 */
export async function scanSite(startUrl: URL): Promise<ScanReport> {
  const host = startUrl.hostname.toLowerCase();
  const startedAt = Date.now();
  const budget = { total: 0 };

  const errors: ScanError[] = [];
  const slow: ScanSlow[] = [];
  const emails = new Set<string>();
  const phones = new Set<string>();
  const pageTimes: number[] = [];

  // Очередь страниц (BFS) и множество увиденных путей/ресурсов.
  const queue: string[] = [startUrl.pathname.replace(/\/+$/, "") || "/"];
  const seenPaths = new Set<string>(queue);
  const resourceSet = new Map<string, AssetKind>(); // абс. URL → тип
  let pagesCrawled = 0;
  let startStatus = 0;
  let finalStartUrl = startUrl.toString();
  let stopped: ScanReport["stopped"] = "done";

  const origin = `${startUrl.protocol}//${startUrl.host}`;

  while (queue.length > 0) {
    if (pagesCrawled >= MAX_PAGES) {
      stopped = "pages";
      break;
    }
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
      stopped = "budget";
      break;
    }
    const path = queue.shift()!;
    const pageUrl = origin + (path === "/" ? "" : path);

    const out = await fetchUrl(pageUrl, true, budget, PAGE_TIMEOUT_MS);
    if (pagesCrawled === 0) {
      startStatus = out.status;
      finalStartUrl = out.finalUrl;
    }
    pagesCrawled += 1;

    // Ошибки/медленность самой страницы.
    if (out.status === 0) {
      errors.push({ url: pageUrl, status: 0, kind: "network", on: pageUrl });
    } else if (out.status >= 400) {
      errors.push({
        url: pageUrl,
        status: out.status,
        kind: out.status >= 500 ? "server" : "client",
        on: pageUrl,
      });
    }
    if (out.ms >= SLOW_MS && out.status !== 0) slow.push({ url: pageUrl, ms: out.ms, kind: "page" });
    if (out.status !== 0) pageTimes.push(out.ms);

    const html = out.body;
    if (!html) continue;

    extractEmails(html, emails);
    extractPhones(html, phones);

    // Ресурсы страницы — копим в общий уникальный набор.
    const absPageUrl = new URL(out.finalUrl);
    for (const r of extractResources(html, absPageUrl)) {
      if (resourceSet.size >= MAX_RESOURCES) break;
      if (!resourceSet.has(r.url)) resourceSet.set(r.url, r.kind);
    }

    // Внутренние ссылки — в очередь на обход.
    for (const href of extractHrefs(html)) {
      const norm = internalPath(href, out.finalUrl, host);
      if (!norm || seenPaths.has(norm)) continue;
      if (pathDepth(norm) > MAX_DEPTH) continue;
      seenPaths.add(norm);
      queue.push(norm);
    }
  }

  // Стартовая страница вообще не открылась — это не отчёт, а ошибка инструмента.
  if (startStatus === 0 && pagesCrawled <= 1) {
    throw new Error("Стартовая страница не ответила — проверьте адрес сайта");
  }

  // Проверяем собранные под-ресурсы (в рамках оставшегося бюджета времени).
  const assets: ScanAsset[] = [];
  const resources = Array.from(resourceSet, ([url, kind]) => ({ url, kind }));
  if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
    stopped = "budget";
  } else {
    if (resourceSet.size >= MAX_RESOURCES && stopped === "done") stopped = "resources";
    await runPool(resources, CONCURRENCY, async (r) => {
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) return;
      const out = await fetchUrl(r.url, false, budget, RES_TIMEOUT_MS);
      assets.push({ url: r.url, kind: r.kind, status: out.status, ms: out.ms, bytes: out.bytes });
      if (out.status === 0) {
        errors.push({ url: r.url, status: 0, kind: "network", on: r.url });
      } else if (out.status >= 400) {
        errors.push({
          url: r.url,
          status: out.status,
          kind: out.status >= 500 ? "server" : "client",
          on: r.url,
        });
      }
      if (out.ms >= SLOW_MS && out.status !== 0) slow.push({ url: r.url, ms: out.ms, kind: r.kind });
    });
  }

  // Сортировки для читаемого отчёта: ошибки по коду убыв., медленные и статика по времени убыв.
  errors.sort((a, b) => b.status - a.status);
  slow.sort((a, b) => b.ms - a.ms);
  assets.sort((a, b) => b.ms - a.ms);

  const requestsTotal = pagesCrawled + assets.length;
  const avgPageMs =
    pageTimes.length > 0 ? Math.round(pageTimes.reduce((s, t) => s + t, 0) / pageTimes.length) : 0;

  const emailList = Array.from(emails).sort();
  const phoneList = Array.from(phones).sort();

  let domain = host;
  try {
    domain = new URL(finalStartUrl).hostname;
  } catch {
    /* оставляем исходный host */
  }

  return {
    startUrl: startUrl.toString(),
    finalUrl: finalStartUrl,
    domain,
    statusCode: startStatus,
    pagesCrawled,
    requestsTotal,
    transferBytes: budget.total,
    durationMs: Date.now() - startedAt,
    stopped,
    backendErrors: errors.slice(0, MAX_LIST),
    slowRequests: slow.slice(0, MAX_LIST),
    staticAssets: assets.slice(0, MAX_ASSETS_LIST),
    emails: emailList.slice(0, MAX_LIST),
    phones: phoneList.slice(0, MAX_LIST),
    summary: {
      errors: errors.length,
      slow: slow.length,
      assets: assets.length,
      emails: emailList.length,
      phones: phoneList.length,
      avgPageMs,
    },
  };
}
