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
const MAX_FORMS = 25; // сколько форм максимум учесть в отчёте
const MAX_FORM_SUBMITS = 10; // сколько форм максимум реально отправить за обход
const FORM_SUBMIT_WAIT_MS = 4500; // сколько ждать реакцию после отправки формы

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

/** JavaScript-ошибка на странице (uncaught exception или console.error). */
export interface ScanJsError {
  message: string;
  on: string; // страница, где впервые встретилась
  count: number;
}

/** Проблема формы, найденная при проверке. */
export interface ScanFormBug {
  severity: "error" | "warning";
  message: string;
}

/** Проверенная форма: где, куда шлёт, заполнили ли, отправили ли и найденные проблемы. */
export interface ScanForm {
  page: string; // страница, где форма
  action: string; // куда отправляется (абсолютный URL)
  method: string; // GET | POST
  fields: number; // число заполняемых полей
  filled: boolean; // заполнили тестовыми данными
  submitted: boolean; // отправили
  skippedPayment: boolean; // пропущена как форма оплаты
  issues: ScanFormBug[]; // найденные проблемы
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
  jsErrors: ScanJsError[]; // JS-ошибки на страницах
  forms: ScanForm[]; // проверенные формы и их проблемы
  emails: string[];
  phones: string[];
  summary: {
    errors: number;
    slow: number;
    assets: number;
    emails: number;
    phones: number;
    jsErrors: number;
    formsChecked: number;
    formBugs: number;
    avgPageMs: number; // средняя скорость загрузки DOM (DOMContentLoaded) по страницам
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

// Домены аналитики/метрики и рекламы Google и Яндекса. Их запросы игнорируем при обходе —
// это не бэкенд владельца сайта, они часто медленные/блокируются и только зашумляют отчёт.
const IGNORED_HOST_SUFFIXES = [
  // Google (Analytics / Tag Manager / Ads / DoubleClick)
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "googletagservices.com",
  "googlesyndication.com",
  "googleadservices.com",
  "doubleclick.net",
  "google-analytics.l.google.com",
  // Яндекс (Метрика / Директ / рекламная сеть)
  "mc.yandex.ru",
  "mc.yandex.com",
  "metrika.yandex.ru",
  "an.yandex.ru",
  "yabs.yandex.ru",
  "ads.yandex.ru",
  "yandexadexchange.net",
  "adfox.ru",
  "adfox.yandex.ru",
];

/** Запрос к аналитике/метрике Google или Яндекса? (такие запросы при обходе игнорируем). */
function isAnalyticsUrl(url: string): boolean {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return IGNORED_HOST_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
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

// -------------------- Проверка форм --------------------

// Тестовые данные для заполнения форм. Явно «проверочные», чтобы владелец сайта понимал,
// что это автоматический тест, а не реальная заявка. Почта — куда придут возможные ответы.
const FORM_TEST_DATA = {
  email: process.env.SCAN_FORM_EMAIL || "check@logsy.ru",
  phone: "+70000000000",
  name: "Проверка Logsy",
  message:
    "Это автоматическая проверка сайта сервисом Logsy (logsy.ru). Извините за беспокойство, реагировать не нужно.",
  password: "Logsy-Check-12345",
  url: "https://logsy.ru",
  text: "Проверка Logsy",
};

// Признаки платёжной формы — такие формы не заполняем и не отправляем (реальные списания).
const PAYMENT_FIELD_RE = /(card.?number|cardnum|cc-?number|creditcard|\bpan\b|cvv|cvc|cvv2|securitycode|expir|\bcc-)/i;

// Описатель одной формы, снятый со страницы в браузере.
interface FormDescriptor {
  idx: number;
  action: string;
  method: string;
  hasSubmit: boolean;
  fields: {
    tag: string;
    type: string;
    name: string;
    id: string;
    placeholder: string;
    autocomplete: string;
    required: boolean;
  }[];
}

/** Снимает описатели всех форм со страницы (без заполнения). */
async function readForms(page: import("playwright-core").Page): Promise<FormDescriptor[]> {
  // Внутри evaluate НЕ объявляем именованные функции/const-стрелки: бандлер (esbuild/tsx)
  // оборачивает их в helper __name, которого нет в браузере → ReferenceError. Только инлайн.
  return page
    .evaluate(() => {
      const skip = ["submit", "button", "image", "reset", "hidden", "file"];
      return Array.from(document.forms)
        .slice(0, 25)
        .map((f, idx) => ({
          idx,
          action: (f as HTMLFormElement).action || location.href,
          method: ((f as HTMLFormElement).method || "get").toLowerCase(),
          hasSubmit: !!f.querySelector(
            "button, input[type=submit], input[type=image], button[type=submit]",
          ),
          fields: Array.from(f.elements)
            .filter(
              (el) =>
                (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT") &&
                !skip.includes(((el as HTMLInputElement).type || "").toLowerCase()),
            )
            .map((el) => {
              const e = el as HTMLInputElement;
              return {
                tag: el.tagName,
                type: (e.type || "").toLowerCase(),
                name: e.name || "",
                id: e.id || "",
                placeholder: e.placeholder || "",
                autocomplete: (e.autocomplete || "").toLowerCase(),
                required: !!e.required,
              };
            }),
        }));
    })
    .catch(() => [] as FormDescriptor[]);
}

/** Статический анализ формы (безопасно, без отправки): небезопасность, кривая разметка. */
function analyzeForm(f: FormDescriptor, pageUrl: string): ScanFormBug[] {
  const bugs: ScanFormBug[] = [];
  const pageHttps = pageUrl.startsWith("https:");
  const hasPassword = f.fields.some((x) => x.type === "password");
  let actionUrl: URL | null = null;
  try {
    actionUrl = new URL(f.action, pageUrl);
  } catch {
    /* некорректный action */
  }

  if (hasPassword && (!pageHttps || (actionUrl && actionUrl.protocol === "http:"))) {
    bugs.push({ severity: "error", message: "Пароль отправляется по незащищённому соединению (HTTP)" });
  }
  if (pageHttps && actionUrl && actionUrl.protocol === "http:") {
    bugs.push({ severity: "error", message: "Форма отправляет данные на незащищённый адрес (http://)" });
  }
  if (f.fields.length > 0 && f.fields.every((x) => !x.name && !x.id)) {
    bugs.push({ severity: "warning", message: "У полей формы нет name/id — данные могут не дойти до сервера" });
  }
  if (!f.hasSubmit && f.fields.length > 0) {
    bugs.push({ severity: "warning", message: "В форме нет кнопки отправки" });
  }
  const emailField = f.fields.find(
    (x) => x.type === "email" || /e-?mail|почт/i.test(`${x.name} ${x.id} ${x.placeholder}`),
  );
  if (emailField && emailField.type !== "email") {
    bugs.push({ severity: "warning", message: "Поле почты не имеет type=email — нет проверки формата" });
  }
  return bugs;
}

/** Заполняет форму тестовыми данными в браузере. Возвращает число заполненных полей и невалидные поля. */
async function fillForm(
  page: import("playwright-core").Page,
  idx: number,
): Promise<{ filled: number; invalid: string[] }> {
  // Без именованных функций внутри evaluate (см. комментарий в readForms) — только инлайн.
  return page
    .evaluate(
      ({ idx, data }) => {
        const f = document.forms[idx];
        if (!f) return { filled: 0, invalid: [] as string[] };
        let filled = 0;
        for (const el0 of Array.from(f.elements)) {
          const el = el0 as HTMLInputElement;
          const tag = el.tagName;
          const type = (el.type || "").toLowerCase();
          if (["submit", "button", "image", "reset", "hidden", "file"].includes(type)) continue;
          const hint = `${el.name || ""} ${el.id || ""} ${el.placeholder || ""} ${el.autocomplete || ""}`.toLowerCase();
          if (tag === "SELECT") {
            const sel = el as unknown as HTMLSelectElement;
            const opt = Array.from(sel.options).find((o) => o.value);
            if (opt) {
              sel.value = opt.value;
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              filled++;
            }
            continue;
          }
          if (type === "checkbox") {
            if (el.required && !el.checked) {
              el.checked = true;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              filled++;
            }
            continue;
          }
          if (type === "radio") {
            if (!el.checked) {
              el.checked = true;
              el.dispatchEvent(new Event("change", { bubbles: true }));
              filled++;
            }
            continue;
          }
          let val: string | null = null;
          if (type === "email" || /e-?mail|почт/.test(hint)) val = data.email;
          else if (type === "tel" || /phone|tel|телефон/.test(hint)) val = data.phone;
          else if (type === "password") val = data.password;
          else if (type === "number" || type === "range") val = "1";
          else if (type === "url" || /url|сайт|website/.test(hint)) val = data.url;
          else if (type === "date") val = "2000-01-01";
          else if (tag === "TEXTAREA" || /message|comment|сообщен|коммент|вопрос|отзыв/.test(hint))
            val = data.message;
          else if (/name|имя|fio|фио|фамил/.test(hint)) val = data.name;
          else if (tag === "INPUT") val = data.text;
          if (val === null) continue;
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          filled++;
        }
        const invalid = Array.from(f.elements)
          .filter((el) => {
            const e = el as HTMLInputElement;
            return e.willValidate && !e.checkValidity();
          })
          .map((el) => (el as HTMLInputElement).name || (el as HTMLInputElement).type || "поле");
        return { filled, invalid };
      },
      { idx, data: FORM_TEST_DATA },
    )
    .catch(() => ({ filled: 0, invalid: [] as string[] }));
}

/**
 * Реально отправляет форму (клик по кнопке отправки или requestSubmit). Дожидается завершения
 * навигации от сабмита (для обычных форм) или затишья сети (для AJAX-форм) — иначе следующий
 * переход обхода прервал бы запрос и создал бы ложную «сетевую ошибку».
 */
async function submitForm(page: import("playwright-core").Page, idx: number): Promise<void> {
  // Готовим ожидание навигации ДО клика, чтобы не пропустить её.
  const navPromise = page
    .waitForNavigation({ timeout: FORM_SUBMIT_WAIT_MS, waitUntil: "domcontentloaded" })
    .catch(() => null);
  await page
    .evaluate((idx) => {
      const f = document.forms[idx];
      if (!f) return;
      const btn = f.querySelector<HTMLElement>(
        "button[type=submit], input[type=submit], input[type=image], button:not([type])",
      );
      if (btn) btn.click();
      else (f as HTMLFormElement).requestSubmit?.();
    }, idx)
    .catch(() => {});
  await navPromise; // дождаться перехода (или таймаута для AJAX-форм)
  await page.waitForLoadState("networkidle", { timeout: 2500 }).catch(() => {});
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
      if (isAnalyticsUrl(url)) return null; // метрику Google/Яндекса игнорируем
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

    // Захват JS-ошибок страницы: необработанные исключения и console.error. Шум (провалы
    // загрузки ресурсов, favicon, cookie-предупреждения) отсекаем — это не баги кода.
    const jsErrorMap = new Map<string, ScanJsError>();
    const noteJsError = (raw: string) => {
      const m = raw.replace(/\s+/g, " ").trim().slice(0, 300);
      if (!m) return;
      if (/Failed to load resource|net::ERR|favicon|ERR_BLOCKED|A cookie associated|was preloaded/i.test(m)) return;
      const cur = jsErrorMap.get(m);
      if (cur) cur.count += 1;
      else if (jsErrorMap.size < 100) jsErrorMap.set(m, { message: m, on: currentPage, count: 1 });
    };
    page.on("pageerror", (err) => noteJsError(err.message || String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") noteJsError(msg.text());
    });

    const emails = new Set<string>();
    const phones = new Set<string>();

    // Проверка форм: собираем уникальные формы (по подписи) и план на отправку.
    const forms: ScanForm[] = [];
    const testedFormSigs = new Set<string>();
    const submitPlan: { formRef: ScanForm; pageUrl: string; sig: string }[] = [];
    const formSig = (d: FormDescriptor, pageUrl: string): string => {
      let action = d.action;
      try {
        action = new URL(d.action, pageUrl).toString();
      } catch {
        /* оставляем как есть */
      }
      return `${d.method}|${action}|${d.fields.map((x) => x.name || x.type).join(",")}`;
    };

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
      const wallMs = Date.now() - t0;
      pagesCrawled += 1;

      // Реальная скорость загрузки DOM (DOMContentLoaded) из Navigation Timing API —
      // время, за которое браузер разобрал HTML и построил DOM. Если API недоступен,
      // берём настенное время перехода как запасной вариант.
      const domMs = await page
        .evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;
          if (nav && nav.domContentLoadedEventEnd > 0) return Math.round(nav.domContentLoadedEventEnd);
          const t = performance.timing;
          if (t && t.domContentLoadedEventEnd && t.navigationStart) {
            return t.domContentLoadedEventEnd - t.navigationStart;
          }
          return 0;
        })
        .catch(() => 0);
      const loadMs = domMs > 0 ? domMs : wallMs;

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

      // Формы: статический анализ каждой уникальной формы; заполнение/отправку планируем
      // отдельным проходом после обхода (чтобы навигация от сабмита не мешала обходу).
      if (forms.length < MAX_FORMS) {
        const descriptors = await readForms(page);
        for (const d of descriptors) {
          if (forms.length >= MAX_FORMS) break;
          const sig = formSig(d, pageUrl);
          if (testedFormSigs.has(sig)) continue;
          testedFormSigs.add(sig);
          let action = d.action;
          try {
            action = new URL(d.action, pageUrl).toString();
          } catch {
            /* оставляем как есть */
          }
          const isPayment = d.fields.some((x) =>
            PAYMENT_FIELD_RE.test(`${x.name} ${x.id} ${x.autocomplete} ${x.placeholder} ${x.type}`),
          );
          const rec: ScanForm = {
            page: pageUrl,
            action,
            method: d.method.toUpperCase(),
            fields: d.fields.length,
            filled: false,
            submitted: false,
            skippedPayment: isPayment,
            issues: analyzeForm(d, pageUrl),
          };
          if (isPayment) {
            rec.issues.push({ severity: "warning", message: "Форма оплаты — не заполнялась и не отправлялась" });
          }
          forms.push(rec);
          if (!isPayment && d.fields.length > 0) {
            submitPlan.push({ formRef: rec, pageUrl, sig });
          }
        }
      }
    }

    // Проход отправки форм: заполняем тестовыми данными и реально отправляем (кроме форм
    // оплаты). Последствия (ошибки бэкенда, JS-ошибки) попадают в общий захват по currentPage.
    let formSubmits = 0;
    for (const plan of submitPlan) {
      if (formSubmits >= MAX_FORM_SUBMITS) break;
      if (Date.now() - startedAt > TOTAL_BUDGET_MS) break;
      currentPage = plan.pageUrl;
      try {
        await page.goto(plan.pageUrl, { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: IDLE_TIMEOUT_MS }).catch(() => {});
      } catch {
        continue;
      }
      // Находим ту же форму по подписи на свежей странице.
      const descriptors = await readForms(page);
      const target = descriptors.find((d) => formSig(d, plan.pageUrl) === plan.sig);
      if (!target) continue;
      const { filled, invalid } = await fillForm(page, target.idx);
      plan.formRef.filled = filled > 0;
      if (filled > 0 && invalid.length > 0) {
        plan.formRef.issues.push({
          severity: "warning",
          message: `Поля не проходят проверку даже с корректными данными: ${invalid.slice(0, 5).join(", ")}`,
        });
      }
      await submitForm(page, target.idx);
      plan.formRef.submitted = true;
      formSubmits += 1;
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

    // Средняя скорость загрузки DOM по обойдённым страницам (DOMContentLoaded).
    const domTimes = pages.map((p) => p.ms).filter((m) => m > 0);
    const avgPageMs =
      domTimes.length > 0
        ? Math.round(domTimes.reduce((s, t) => s + t, 0) / domTimes.length)
        : 0;

    const emailList = Array.from(emails).sort();
    const phoneList = Array.from(phones).sort();

    const jsErrors = Array.from(jsErrorMap.values()).sort((a, b) => b.count - a.count);
    const formBugs = forms.reduce((n, f) => n + f.issues.length, 0);

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
      jsErrors: jsErrors.slice(0, MAX_LIST),
      forms: forms.slice(0, MAX_FORMS),
      emails: emailList.slice(0, MAX_LIST),
      phones: phoneList.slice(0, MAX_LIST),
      summary: {
        errors: errors.length,
        slow: slow.length,
        assets: assets.length,
        emails: emailList.length,
        phones: phoneList.length,
        jsErrors: jsErrors.length,
        formsChecked: forms.length,
        formBugs,
        avgPageMs,
      },
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
