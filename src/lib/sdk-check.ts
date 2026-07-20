// Проверка подключения SDK логирования на сайте проекта.
//
// Делает запрос на сайт клиента (домен проекта), вырезает содержимое <head> и ищет в нём
// тег <script> с src, указывающим на наш эндпоинт /api/logger/sdk. По результату панель
// логирования и вкладка «Подключение» показывают, установлен скрипт или ещё нет.
//
// HTML разбираем регэкспами — DOM-парсера в рантайме нет, а нам нужен только один тег
// <script src=…> внутри <head>.

// Таймаут запроса к сайту клиента: главная страница должна ответить быстро, иначе считаем
// проверку не удавшейся (сайт недоступен / слишком медленный).
const FETCH_TIMEOUT_MS = 8000;

export type SdkCheckResult = {
  // Найден ли тег SDK в <head> главной страницы.
  connected: boolean;
  // Причина, если проверить не удалось (сайт недоступен, вернул не HTML и т.п.). null —
  // проверка прошла (независимо от того, найден скрипт или нет).
  error: string | null;
  // Адрес, который реально запрашивали (для подсказки в интерфейсе).
  checkedUrl: string;
};

/** Вырезает содержимое <head> из HTML. Если тега нет — возвращает весь HTML (фолбэк). */
function extractHead(html: string): string {
  const m = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  return m ? m[1] : html;
}

/** Есть ли в отрезке HTML тег <script> с src на наш эндпоинт SDK (/api/logger/sdk). */
function hasSdkScript(html: string): boolean {
  const re = /<script\b[^>]*?\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const src = m[2] ?? m[3] ?? m[4] ?? "";
    // Путь эндпоинта одинаков для всех проектов; хост может отличаться (свой домен панели),
    // поэтому сверяем именно путь, а не полный URL.
    if (/\/api\/logger\/sdk(?:$|[/?#])/i.test(src)) return true;
  }
  return false;
}

/**
 * Запрашивает главную страницу сайта проекта и проверяет, подключён ли в <head> тег SDK.
 * Никогда не бросает исключение: при любой ошибке возвращает connected=false с текстом
 * причины в error.
 */
export async function checkSdkInstalled(domain: string): Promise<SdkCheckResult> {
  const host = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "");
  const url = `https://${host}`;

  // Cache-busting: cache: "no-store" отключает только кеш Next.js/undici на нашей стороне,
  // но не заставляет CDN/reverse-proxy/плагин кеширования на стороне клиента (Cloudflare
  // «Cache Everything», WP Rocket и т.п.) отдать свежую страницу. Из-за этого после того,
  // как клиент убрал или обновил скрипт, нам мог приходить старый HTML и проверка врала.
  // Уникальный query-параметр меняет ключ кеша и обходит его; заголовки no-cache просят
  // не отдавать закешированное там, где их учитывают.
  const cacheBuster = `logsy_cb=${Date.now()}`;
  const fetchUrl = url + (url.includes("?") ? "&" : "?") + cacheBuster;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(fetchUrl, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": "LogsyBot/1.0 (+https://logsy.ru)",
        accept: "text/html",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { connected: false, error: `Сайт ответил ошибкой ${res.status}`, checkedUrl: url };
    }
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) {
      return { connected: false, error: "Главная страница вернула не HTML", checkedUrl: url };
    }
    const html = await res.text();
    return { connected: hasSdkScript(extractHead(html)), error: null, checkedUrl: url };
  } catch {
    return { connected: false, error: "Не удалось открыть сайт", checkedUrl: url };
  } finally {
    clearTimeout(timer);
  }
}
