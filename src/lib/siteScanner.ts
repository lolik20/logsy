// Сканер сайта для админ-инструмента «Обход». По одному URL настоящий headless-браузер
// (Chromium через Playwright) обходит сайт: открывает стартовую страницу, исполняет её JS,
// идёт по внутренним ссылкам (BFS в пределах хоста) и на каждой странице слушает реальные
// сетевые события браузера. По ходу обхода собирает:
//   • ошибки бэкенда — ответы с кодом >= 400 и упавшие запросы (страниц, API и ресурсов);
//   • медленные запросы — всё, что грузилось дольше порога (документы, XHR/fetch, файлы);
//   • статику — подключённые файлы (js/css/img/шрифты) с реальным размером и временем;
//   • почты и телефоны — из отрисованной разметки (mailto:/tel: и текст, уже после JS).
// Итог — единый JSON-отчёт по сайту.
//
// В отличие от проверки скорости, здесь именно headless-браузер: он исполняет JavaScript
// (важно для SPA и динамически подставляемых контактов) и даёт точные коды/тайминги сетевых
// запросов так, как их видит настоящий посетитель. Браузер — Chromium, находится Playwright'ом
// автоматически (переменная PLAYWRIGHT_BROWSERS_PATH) либо по пути из PLAYWRIGHT_CHROMIUM_PATH.

import { chromium, type Browser, type Request as PwRequest } from "playwright-core";

// --- Пределы обхода (чтобы не подвесить запрос на крупном сайте) ---
const MAX_PAGES = 20; // сколько HTML-страниц максимум обойти
const MAX_DEPTH = 4; // максимальная глубина вложенности пути от корня
const MAX_REQUESTS = 800; // сколько сетевых запросов максимум учесть
const NAV_TIMEOUT_MS = 20_000; // таймаут перехода на страницу
const IDLE_TIMEOUT_MS = 6_000; // сколько ждать «затишья» сети после загрузки
const TOTAL_BUDGET_MS = 55_000; // общий бюджет обхода (route maxDuration = 60)
const SLOW_MS = 2000; // порог «медленного» запроса при обходе — 2 секунды

// Ограничения на размер отчёта — чтобы длинные списки не раздували ответ.
const MAX_LIST = 100; // максимум записей в списках ошибок/медленных/почт/телефонов
const MAX_ASSETS_LIST = 200; // максимум записей в списке статики

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 LogsyBot/1.0";

// Расширения файлов, которые не являются HTML-страницами (не ставим их в очередь обхода).
const ASSET_EXT_ANY =
  /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|map|wasm|pdf|zip|mp4|webm|mp3|xml|json)$/i;

export type AssetKind = "script" | "style" | "image" | "font" | "other";
// Тип сетевого запроса для медленных: страница, статика или динамический запрос (XHR/fetch).
export type RequestKind = "page" | "script" | "style" | "image" | "font" | "xhr" | "other";

/** Ошибка запроса: ответ >= 400 или упавший запрос (для страницы, API или ресурса). */
export interface ScanError {
  url: string; // адрес запроса
  status: number; // HTTP-код (0 — запрос упал/оборвался)
  kind: "server" | "client" | "network"; // 5xx | 4xx | обрыв соединения
  on: string; // на какой странице встретился (первое вхождение)
  count: number; // сколько раз повторился (одинаковые запросы не дублируются)
}

/** Медленный запрос: страница, ресурс или XHR/fetch, загрузка дольше порога. */
export interface ScanSlow {
  url: string;
  ms: number; // максимальное время из повторов
  kind: RequestKind;
  count: number; // сколько раз повторился
}

/** Статический файл, подключённый на страницах сайта. */
export interface ScanAsset {
  url: string;
  kind: AssetKind;
  status: number;
  ms: number;
  bytes: number;
}

/** Критический момент на странице: ошибка бэкенда или медленный запрос. */
export interface ScanPageIssue {
  url: string; // адрес запроса
  type: "error" | "slow"; // ошибка или медленный запрос
  status: number; // HTTP-код (для ошибок; 0 — обрыв)
  ms: number; // время запроса (для медленных)
  kind: RequestKind; // тип запроса (страница/скрипт/xhr/…)
  errorKind: "server" | "client" | "network" | null; // класс ошибки (для type=error)
  count: number; // сколько раз повторился на этой странице
}

/** Страница сайта в карте: адрес, заголовок и её критические моменты. */
export interface ScanPage {
  url: string; // адрес страницы
  path: string; // путь (pathname)
  title: string | null; // <title> страницы
  depth: number; // глубина в дереве каталогов (корень — 0)
  status: number; // код ответа документа
  ms: number; // время загрузки страницы
  errors: number; // число ошибок на странице
  slow: number; // число медленных запросов на странице
  issues: ScanPageIssue[]; // критические моменты (ошибки + медленные), без дублей
}

/** Итоговый отчёт по сайту. */
export interface ScanReport {
  startUrl: string;
  finalUrl: string;
  domain: string;
  statusCode: number; // код ответа стартовой страницы
  pagesCrawled: number; // сколько HTML-страниц обошли
  requestsTotal: number; // всего учтённых сетевых запросов
  transferBytes: number; // суммарный трафик (тела ответов)
  durationMs: number; // сколько занял обход
  stopped: "done" | "pages" | "requests" | "budget"; // причина остановки обхода
  pages: ScanPage[]; // карта сайта: обойдённые страницы с их критическими моментами
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
    avgPageMs: number; // среднее время загрузки HTML-страниц (по документным запросам)
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

/** Тип сетевого запроса Playwright → наш RequestKind. */
function requestKind(resourceType: string): RequestKind {
  switch (resourceType) {
    case "document":
      return "page";
    case "script":
      return "script";
    case "stylesheet":
      return "style";
    case "image":
      return "image";
    case "font":
      return "font";
    case "xhr":
    case "fetch":
      return "xhr";
    default:
      return "other";
  }
}

/** Тип статического файла (для списка статики) или null, если это не статика. */
function assetKind(resourceType: string): AssetKind | null {
  switch (resourceType) {
    case "script":
      return "script";
    case "stylesheet":
      return "style";
    case "image":
      return "image";
    case "font":
      return "font";
    default:
      return null;
  }
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
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  return path;
}

function pathDepth(path: string): number {
  return path.split("/").filter(Boolean).length;
}

// --- Извлечение почт и телефонов из отрисованной разметки ---

const EMAIL_RE =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)+/g;

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
  if (digits.length === 11 && (digits[0] === "7" || digits[0] === "8")) {
    return "+7" + digits.slice(1);
  }
  if (digits.length === 10 && !plus) {
    return "+7" + digits;
  }
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

/**
 * Запускает headless-Chromium. Путь к бинарнику — из env или автоопределение Playwright.
 * Частые ошибки окружения (браузер не установлен / не хватает системных библиотек)
 * превращаем в короткое понятное сообщение с командой-подсказкой вместо сырого лога.
 */
export async function launchBrowser(): Promise<Browser> {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROMIUM_PATH || undefined;
  try {
    return await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Не хватает системных библиотек (libatk, libnss3 и т.п.) — нужен --with-deps.
    if (/shared librar|cannot open shared object|error while loading/i.test(msg)) {
      throw new Error(
        "Не хватает системных библиотек для Chromium. Установите их: " +
          "npx playwright-core install --with-deps chromium",
      );
    }
    // Браузер не скачан или не той ревизии.
    if (/Executable doesn't exist|playwright install|Please run/i.test(msg)) {
      throw new Error(
        "Chromium для обхода не установлен на сервере. Установите его: " +
          "npx playwright-core install chromium",
      );
    }
    throw new Error("Не удалось запустить браузер для обхода: " + msg.split("\n")[0]);
  }
}

// Учтённый сетевой запрос. Код/тайминг/размер снимаются сразу в момент события
// (requestfinished/requestfailed): после перехода на следующую страницу Playwright уже не
// отдаёт response() для запросов прошлых страниц, поэтому ленивое чтение в конце теряло бы
// коды ответов ранее обойдённых страниц.
interface CapturedRequest {
  url: string;
  status: number; // HTTP-код (0 — упавший/оборванный запрос)
  kind: RequestKind;
  asset: AssetKind | null;
  ms: number;
  bytes: number;
  on: string; // страница, при обходе которой пошёл запрос
  failed: boolean;
}

/**
 * Обходит сайт по стартовому URL настоящим headless-браузером и формирует отчёт: ошибки
 * бэкенда, медленные запросы, статика, найденные почты и телефоны. Кидает ошибку, если
 * стартовая страница не открылась.
 */
export async function scanSite(startUrl: URL): Promise<ScanReport> {
  const host = startUrl.hostname.toLowerCase();
  const origin = `${startUrl.protocol}//${startUrl.host}`;
  const startedAt = Date.now();

  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true, userAgent: UA });
    context.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
    const page = await context.newPage();

    // Захват сетевых событий браузера. currentPage — страница, к которой относятся запросы
    // (обход последовательный, поэтому атрибуция однозначна). Одна строка на запрос (ключ —
    // объект Request). Код ответа берём из события `response` (приходит с заголовками ещё до
    // того, как Chromium прервёт тело — например, у скрипта с ответом 500), тайминг и размер —
    // из `requestfinished`, а `requestfailed` считаем настоящим сетевым сбоем только если
    // заголовков ответа так и не было (DNS/обрыв соединения, а не HTTP-код ошибки).
    const rows = new Map<PwRequest, CapturedRequest>();
    const pending: Promise<void>[] = [];
    let currentPage = startUrl.toString();

    const rowFor = (req: PwRequest): CapturedRequest | null => {
      let row = rows.get(req);
      if (row) return row;
      if (rows.size >= MAX_REQUESTS) return null;
      const url = req.url();
      if (url.startsWith("data:") || url.startsWith("blob:")) return null;
      const rt = req.resourceType();
      row = {
        url,
        status: -1, // ответа ещё не было
        kind: requestKind(rt),
        asset: assetKind(rt),
        ms: 0,
        bytes: 0,
        on: currentPage,
        failed: false,
      };
      rows.set(req, row);
      return row;
    };

    page.on("response", (resp) => {
      const row = rowFor(resp.request());
      if (row) row.status = resp.status();
    });
    page.on("requestfinished", (req) => {
      const row = rowFor(req);
      if (!row) return;
      const t = req.timing();
      row.ms = t.responseEnd > 0 ? Math.round(t.responseEnd) : 0;
      pending.push(
        req
          .sizes()
          .then((s) => {
            row.bytes = s.responseBodySize || 0;
          })
          .catch(() => {}),
      );
    });
    page.on("requestfailed", (req) => {
      const row = rowFor(req);
      // Настоящий сетевой сбой — только когда заголовков ответа не было. Прерывание тела
      // после кода ошибки (aborted у 5xx-скрипта) не считаем «нет ответа»: код уже известен.
      if (row && row.status < 0) row.failed = true;
    });

    const emails = new Set<string>();
    const phones = new Set<string>();

    // Метаданные обойдённых страниц (для карты сайта). Ключ — pageUrl (совпадает с `on`).
    const pageMetas = new Map<
      string,
      { url: string; path: string; title: string | null; depth: number; status: number; ms: number }
    >();

    const queue: string[] = [startUrl.pathname.replace(/\/+$/, "") || "/"];
    const seen = new Set<string>(queue);
    let pagesCrawled = 0;
    let startStatus = 0;
    let finalStartUrl = startUrl.toString();
    let stopped: ScanReport["stopped"] = "done";

    while (queue.length > 0) {
      if (pagesCrawled >= MAX_PAGES) {
        stopped = "pages";
        break;
      }
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
        stopped = "budget";
        break;
      }
      if (rows.size >= MAX_REQUESTS) {
        stopped = "requests";
        break;
      }

      const path = queue.shift()!;
      const pageUrl = origin + (path === "/" ? "" : path);
      currentPage = pageUrl;

      let status = 0;
      const t0 = Date.now();
      try {
        const resp = await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
        status = resp?.status() ?? 0;
        if (pagesCrawled === 0) {
          startStatus = status;
          finalStartUrl = resp?.url() || pageUrl;
        }
      } catch (err) {
        // Первая же страница не открылась — это не отчёт, а ошибка инструмента.
        if (pagesCrawled === 0) {
          throw new Error("Стартовая страница не открылась — проверьте адрес сайта");
        }
        pagesCrawled += 1;
        continue; // упавший переход учтётся как requestfailed
      }

      // Ждём «затишья» сети — чтобы поймать XHR/подгрузку после первичного рендера.
      await page.waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
      const loadMs = Date.now() - t0;
      pagesCrawled += 1;

      // Заголовок и контакты — из отрисованной разметки (после исполнения JS).
      const title = (await page.title().catch(() => "")) || null;
      pageMetas.set(pageUrl, { url: pageUrl, path, title, depth: pathDepth(path), status, ms: loadMs });

      const content = await page.content().catch(() => "");
      if (content) {
        extractEmails(content, emails);
        extractPhones(content, phones);
      }

      // Внутренние ссылки — в очередь на обход.
      const hrefs: string[] = await page
        .$$eval("a[href]", (els) =>
          els.map((e) => (e as HTMLAnchorElement).getAttribute("href") || ""),
        )
        .catch(() => []);
      const here = page.url();
      for (const href of hrefs) {
        const norm = internalPath(href, here, host);
        if (!norm || seen.has(norm)) continue;
        if (pathDepth(norm) > MAX_DEPTH) continue;
        seen.add(norm);
        queue.push(norm);
      }
    }

    // Дожидаемся, пока доснимутся размеры последних сетевых событий.
    await Promise.all(pending);

    // Стартовая страница вообще не отдала документ и запросов не было — некорректный сайт.
    if (startStatus === 0 && rows.size === 0) {
      throw new Error("Стартовая страница не ответила — проверьте адрес сайта");
    }

    // Обрабатываем собранные сетевые запросы: коды, тайминги, размеры, тип. Повторяющиеся
    // запросы (тот же URL) не дублируем — копим в Map с счётчиком повторов. Глобальные
    // списки ошибок/медленных и, параллельно, критические моменты по каждой странице.
    const errorMap = new Map<string, ScanError>(); // ключ url|status
    const slowMap = new Map<string, ScanSlow>(); // ключ url
    const assetMap = new Map<string, ScanAsset>();
    // Критические моменты по странице: pageUrl → (ключ запроса → ScanPageIssue).
    const pageIssues = new Map<string, Map<string, ScanPageIssue>>();
    const docTimes: number[] = [];
    let transferBytes = 0;

    const addPageIssue = (on: string, key: string, make: () => ScanPageIssue) => {
      let m = pageIssues.get(on);
      if (!m) {
        m = new Map();
        pageIssues.set(on, m);
      }
      const cur = m.get(key);
      if (cur) cur.count += 1;
      else m.set(key, make());
    };

    for (const { url, status, kind, asset, ms, bytes, on, failed } of rows.values()) {
      transferBytes += bytes;

      // --- Ошибки бэкенда (с дедупликацией) ---
      const isNetworkFail = failed && status < 0;
      const isHttpError = !failed && status >= 400;
      if (isNetworkFail || isHttpError) {
        const eStatus = isNetworkFail ? 0 : status;
        const eKind: ScanError["kind"] = isNetworkFail
          ? "network"
          : status >= 500
            ? "server"
            : "client";
        const key = `${url}|${eStatus}`;
        const cur = errorMap.get(key);
        if (cur) cur.count += 1;
        else errorMap.set(key, { url, status: eStatus, kind: eKind, on, count: 1 });
        addPageIssue(on, `e:${key}`, () => ({
          url,
          type: "error",
          status: eStatus,
          ms: ms > 0 ? ms : 0,
          kind,
          errorKind: eKind,
          count: 1,
        }));
      }

      if (failed) continue;
      if (status < 0) continue; // запрос не завершился (ответа не было) — пропускаем

      if (kind === "page" && ms > 0) docTimes.push(ms);

      // --- Медленные запросы (с дедупликацией; храним максимальное время) ---
      if (ms >= SLOW_MS) {
        const cur = slowMap.get(url);
        if (cur) {
          cur.count += 1;
          if (ms > cur.ms) cur.ms = ms;
        } else {
          slowMap.set(url, { url, ms, kind, count: 1 });
        }
        addPageIssue(on, `s:${url}`, () => ({
          url,
          type: "slow",
          status,
          ms,
          kind,
          errorKind: null,
          count: 1,
        }));
      }

      if (asset && !assetMap.has(url)) {
        assetMap.set(url, { url, kind: asset, status, ms, bytes });
      }
    }

    // Сортировки для читаемого отчёта.
    const errors = Array.from(errorMap.values()).sort((a, b) => b.status - a.status);
    const slow = Array.from(slowMap.values()).sort((a, b) => b.ms - a.ms);
    const assets = Array.from(assetMap.values()).sort((a, b) => b.ms - a.ms);

    // Карта сайта: обойдённые страницы (по пути) с их критическими моментами.
    const pages: ScanPage[] = Array.from(pageMetas.values())
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((meta) => {
        const issues = Array.from(pageIssues.get(meta.url)?.values() ?? []).sort((a, b) => {
          // Ошибки выше медленных, затем по коду/времени.
          if (a.type !== b.type) return a.type === "error" ? -1 : 1;
          return a.type === "error" ? b.status - a.status : b.ms - a.ms;
        });
        return {
          url: meta.url,
          path: meta.path,
          title: meta.title,
          depth: meta.depth,
          status: meta.status,
          ms: meta.ms,
          errors: issues.filter((i) => i.type === "error").length,
          slow: issues.filter((i) => i.type === "slow").length,
          issues,
        };
      });

    const avgPageMs =
      docTimes.length > 0
        ? Math.round(docTimes.reduce((s, t) => s + t, 0) / docTimes.length)
        : 0;

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
      requestsTotal: rows.size,
      transferBytes,
      durationMs: Date.now() - startedAt,
      stopped,
      pages: pages.slice(0, MAX_PAGES),
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
  } finally {
    await browser.close().catch(() => {});
  }
}
