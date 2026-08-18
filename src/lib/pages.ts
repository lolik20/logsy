// Чистые функции «карты страниц» проекта: нормализация путей, построение дерева
// каталогов/подкаталогов и агрегация метрик загрузки. В БД не ходят — переиспользуются
// краулером (src/lib/crawler.ts) и страницей карты (dashboard/.../pages).

import { normalizeResourceInitiator } from "@/lib/staticAssets";
import { isTrackerEvent } from "@/lib/trackers";

// Расширения файлов-ресурсов, которые НЕ считаем страницами (краулер по ним не ходит,
// в карту не добавляет). Страницы — это HTML-документы, а не картинки/скрипты/архивы.
const ASSET_EXT_RE =
  /\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|css|js|mjs|map|json|xml|txt|pdf|zip|rar|gz|tar|7z|mp4|webm|mov|avi|mp3|wav|ogg|woff2?|ttf|otf|eot|wasm|apk|dmg|exe)$/i;

/**
 * Нормализует ссылку в путь страницы (pathname) в рамках домена проекта. Возвращает null,
 * если ссылка ведёт на другой хост, на не-http(s) схему (mailto/tel/javascript), на файл-
 * ресурс или её нельзя разобрать. Query-строку и hash отбрасываем: карта строится по путям.
 *
 * @param href   значение атрибута href (может быть относительным)
 * @param baseUrl абсолютный URL страницы, на которой встретилась ссылка
 * @param host   хост домена проекта в нижнем регистре (для отсева внешних ссылок)
 */
export function normalizePagePath(
  href: string,
  baseUrl: string,
  host: string,
): string | null {
  const raw = (href || "").trim();
  if (!raw) return null;
  // Явно не-навигационные схемы.
  if (/^(mailto:|tel:|javascript:|data:|blob:|sms:|#)/i.test(raw)) return null;
  let u: URL;
  try {
    u = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // Только тот же хост (домен проекта), поддомены не обходим.
  if (u.hostname.toLowerCase() !== host) return null;
  if (ASSET_EXT_RE.test(u.pathname)) return null;
  return normalizePathname(u.pathname);
}

/** Нормализует pathname: декодирует, схлопывает слэши, убирает завершающий слэш (кроме корня). */
export function normalizePathname(pathname: string): string {
  let p = pathname || "/";
  try {
    p = decodeURI(p);
  } catch {
    /* оставляем как есть */
  }
  p = p.replace(/\/{2,}/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  if (p.length > 1) p = p.replace(/\/+$/, "");
  return p || "/";
}

/** Глубина пути = число непустых сегментов. Корень "/" — 0. */
export function pathDepth(path: string): number {
  if (path === "/") return 0;
  return path.split("/").filter(Boolean).length;
}

/** Путь страницы (pathname) из полного URL или уже-пути. null — если пусто/мусор. */
export function pageUrlToPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return normalizePathname(new URL(url).pathname);
  } catch {
    const p = String(url).split(/[?#]/)[0].trim();
    return p ? normalizePathname(p) : null;
  }
}

// ---- Метрики загрузки страницы (агрегируются из событий PAGE_LOAD сессий) ----

export type PageLoadMetric = {
  // Среднее время до прогрузки конечного контента, мс (по всем замерам страницы).
  avgLoadMs: number;
  // Число замеров (загрузок страницы в сессиях пользователей).
  samples: number;
  // Максимальное зафиксированное время загрузки, мс.
  maxLoadMs: number;
};

/**
 * Агрегирует замеры загрузки по пути страницы. На вход — «сырые» события PAGE_LOAD
 * (url страницы + длительность). Возвращает Map: путь → усреднённая метрика.
 */
export function aggregatePageLoads(
  events: { url: string | null; durationMs: number | null }[],
): Map<string, PageLoadMetric> {
  const acc = new Map<string, { sum: number; n: number; max: number }>();
  for (const e of events) {
    if (e.durationMs == null || e.durationMs <= 0) continue;
    const path = pageUrlToPath(e.url);
    if (!path) continue;
    const cur = acc.get(path) ?? { sum: 0, n: 0, max: 0 };
    cur.sum += e.durationMs;
    cur.n += 1;
    if (e.durationMs > cur.max) cur.max = e.durationMs;
    acc.set(path, cur);
  }
  const out = new Map<string, PageLoadMetric>();
  for (const [path, v] of acc) {
    out.set(path, { avgLoadMs: Math.round(v.sum / v.n), samples: v.n, maxLoadMs: v.max });
  }
  return out;
}

// ---- Счётчики проблем на странице (ошибки / медленные запросы) ----

export type PageCounts = {
  // Ошибки: JS-ошибки, необработанные reject и упавшие сетевые запросы (HTTP_ERROR).
  errors: number;
  // Медленные: медленные сетевые запросы и медленные статические файлы.
  slow: number;
};

// Какие типы событий считаем ошибкой и медленным (совпадает с индикаторами в логировании).
const ERROR_EVENT_TYPES: ReadonlySet<string> = new Set([
  "ERROR",
  "UNHANDLED_REJECTION",
  "HTTP_ERROR",
]);
const SLOW_EVENT_TYPES: ReadonlySet<string> = new Set(["SLOW_REQUEST", "SLOW_RESOURCE"]);

/**
 * Считает число ошибок и медленных запросов на каждой странице (по её пути). На вход —
 * события сессий (тип + url страницы). Возвращает Map: путь → { errors, slow }.
 */
export function aggregatePageCounts(
  events: { type: string; url: string | null; route?: string | null }[],
): Map<string, PageCounts> {
  const out = new Map<string, PageCounts>();
  for (const e of events) {
    // Запросы сторонних счётчиков (Метрика, GA/GTM) в счётчики страницы не берём.
    if (isTrackerEvent(e)) continue;
    const isErr = ERROR_EVENT_TYPES.has(e.type);
    const isSlow = SLOW_EVENT_TYPES.has(e.type);
    if (!isErr && !isSlow) continue;
    const path = pageUrlToPath(e.url);
    if (!path) continue;
    const cur = out.get(path) ?? { errors: 0, slow: 0 };
    if (isErr) cur.errors += 1;
    else cur.slow += 1;
    out.set(path, cur);
  }
  return out;
}

// ---- Критические (медленные) запросы и статические файлы на странице ----

export type CriticalRequest = {
  // URL запроса/ресурса (route события).
  route: string;
  // Тип: RESOURCE (статический файл: скрипт/стиль/картинка/шрифт) | REQUEST (API-запрос).
  kind: "RESOURCE" | "REQUEST";
  // Подтип инициатора для ресурсов (script/css/img/font/…), либо HTTP-метод для запросов.
  initiator: string | null;
  // Максимальная длительность среди замеров, мс.
  maxMs: number;
  // Средняя длительность, мс.
  avgMs: number;
  // Сколько раз запрос был медленным (число событий).
  count: number;
};

/** Событие для разбора критических запросов (совместимо с LogEvent). */
export type SlowEventInput = {
  type: string;
  url: string | null;
  route: string | null;
  method: string | null;
  durationMs: number | null;
};

/**
 * Группирует медленные события (SLOW_RESOURCE — статические файлы; SLOW_REQUEST/HTTP_ERROR —
 * API-запросы) по пути страницы, затем по URL запроса. Возвращает Map: путь → список
 * критических запросов, отсортированный по убыванию максимальной длительности.
 */
export function aggregateCriticalRequests(
  events: SlowEventInput[],
): Map<string, CriticalRequest[]> {
  type Acc = { kind: "RESOURCE" | "REQUEST"; initiator: string | null; sum: number; n: number; max: number };
  const byPath = new Map<string, Map<string, Acc>>();
  for (const e of events) {
    const route = e.route;
    const dur = e.durationMs;
    if (!route || dur == null || dur <= 0) continue;
    // Скрипты и пиксели сторонних счётчиков — не проблема страницы: владелец сайта на их
    // скорость не влияет. В список критических запросов не показываем (см. lib/trackers).
    if (isTrackerEvent(e)) continue;
    const path = pageUrlToPath(e.url);
    if (!path) continue;
    const kind: "RESOURCE" | "REQUEST" = e.type === "SLOW_RESOURCE" ? "RESOURCE" : "REQUEST";
    // Для статики уточняем подтип по расширению: предзагруженные (<link>) картинки/шрифты
    // браузер помечает как «link», хотя по факту это img/font — показываем реальный тип.
    const initiator =
      kind === "RESOURCE" ? normalizeResourceInitiator(route, e.method) : e.method ?? null;
    let routes = byPath.get(path);
    if (!routes) {
      routes = new Map();
      byPath.set(path, routes);
    }
    const cur = routes.get(route) ?? { kind, initiator, sum: 0, n: 0, max: 0 };
    cur.sum += dur;
    cur.n += 1;
    if (dur > cur.max) cur.max = dur;
    routes.set(route, cur);
  }
  const out = new Map<string, CriticalRequest[]>();
  for (const [path, routes] of byPath) {
    const list: CriticalRequest[] = [];
    for (const [route, v] of routes) {
      list.push({
        route,
        kind: v.kind,
        initiator: v.initiator,
        maxMs: v.max,
        avgMs: Math.round(v.sum / v.n),
        count: v.n,
      });
    }
    list.sort((a, b) => b.maxMs - a.maxMs);
    out.set(path, list);
  }
  return out;
}

// ---- Дерево каталогов/подкаталогов ----

export type PageNode = {
  // Сегмент имени в дереве (последняя часть пути), для корня — "/".
  segment: string;
  // Полный путь до этого узла.
  path: string;
  // Является ли узел реальной страницей (есть в списке путей), а не только промежуточным
  // каталогом, синтезированным ради вложенности.
  isPage: boolean;
  // Заголовок страницы (если известен из краулера).
  title: string | null;
  // Источник (CRAWL/SESSION), если это реальная страница.
  source: string | null;
  children: PageNode[];
};

export type PageInput = { path: string; title?: string | null; source?: string | null };

/**
 * Строит дерево каталогов/подкаталогов из плоского списка путей страниц. Промежуточные
 * каталоги, у которых нет собственной страницы, синтезируются как узлы isPage=false.
 * Дети каждого узла сортируются по алфавиту, страницы-каталоги — как обычные узлы.
 */
export function buildPageTree(pages: PageInput[]): PageNode[] {
  const root: PageNode = { segment: "/", path: "/", isPage: false, title: null, source: null, children: [] };
  const nodeByPath = new Map<string, PageNode>([["/", root]]);

  function ensure(path: string): PageNode {
    const existing = nodeByPath.get(path);
    if (existing) return existing;
    const segs = path.split("/").filter(Boolean);
    const parentPath = segs.length <= 1 ? "/" : "/" + segs.slice(0, -1).join("/");
    const parent = ensure(parentPath);
    const node: PageNode = {
      segment: segs[segs.length - 1] ?? "/",
      path,
      isPage: false,
      title: null,
      source: null,
      children: [],
    };
    parent.children.push(node);
    nodeByPath.set(path, node);
    return node;
  }

  for (const p of pages) {
    const path = normalizePathname(p.path);
    const node = ensure(path);
    node.isPage = true;
    node.title = p.title ?? node.title;
    node.source = p.source ?? node.source ?? "CRAWL";
  }

  const sortRec = (n: PageNode) => {
    n.children.sort((a, b) => a.path.localeCompare(b.path));
    n.children.forEach(sortRec);
  };
  sortRec(root);

  // Возвращаем один корневой узел "/", внутри которого лежат все каталоги и подкаталоги.
  root.isPage = root.isPage || pages.some((p) => normalizePathname(p.path) === "/");
  return [root];
}
