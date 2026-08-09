// Определение сайта-источника запроса для keyless-эндпоинтов SDK (/api/logger/*).
//
// Базовая модель: проект определяется по заголовку Origin — браузер выставляет его сам,
// подделать со страницы нельзя, поэтому CORS-гейт работает как авторизация.
//
// Исключение — «первая сторона». Сайт может проксировать Logsy у себя (nginx отдаёт
// /api/logger/ со своего домена на порт Logsy) — так SDK не режут блокировщики. Тогда
// запросы становятся ОДНОГО происхождения с сайтом, и браузер не шлёт Origin вовсе: по
// спецификации Fetch заголовок добавляется только к cross-origin запросам и к методам
// кроме GET/HEAD. В результате GET /api/logger/config приходит без Origin и отбивается
// 403 — фичи проекта (запись экрана, форма ошибок, плашки) молча не включаются.
//
// Для доменов из списка ниже в этом случае определяем сайт по Referer, а если и его нет —
// по X-Forwarded-Host / Host, которые проставляет фронтовый nginx. Список задаётся
// константой и расширяется переменной окружения LOGSY_FIRST_PARTY_DOMAINS (через запятую).
// Поддомены доверенного домена (www.turzila.com) сводятся к самому домену — Project.domain
// ищется по нему.

/** Домены, которые проксируют Logsy у себя и потому шлют запросы без Origin. */
const BUILTIN_FIRST_PARTY_DOMAINS = ["turzila.com", "neiro-kadr.ru"];

function firstPartyDomains(): string[] {
  const extra = (process.env.LOGSY_FIRST_PARTY_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return extra.length ? [...BUILTIN_FIRST_PARTY_DOMAINS, ...extra] : BUILTIN_FIRST_PARTY_DOMAINS;
}

/** Хостнейм из абсолютного URL (Origin, Referer) — без схемы и порта, либо null. */
export function originHostname(origin: string | null): string | null {
  if (!origin) return null;
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Хост из заголовка Host / X-Forwarded-Host: первый в списке, без порта, либо null. */
function headerHost(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim().toLowerCase();
  if (!first) return null;
  // За прокси тут всегда доменное имя, поэтому достаточно отрезать порт с конца.
  const host = first.replace(/:\d+$/, "");
  return host || null;
}

/**
 * Доверенный домен, которому соответствует хост: сам домен либо его поддомен
 * (www.turzila.com → turzila.com). Иначе null.
 */
export function firstPartyDomain(host: string | null): string | null {
  if (!host) return null;
  for (const domain of firstPartyDomains()) {
    if (host === domain || host.endsWith("." + domain)) return domain;
  }
  return null;
}

export type RequestOrigin = {
  /** Значение для Access-Control-Allow-Origin (эхо конкретного домена), либо null. */
  origin: string | null;
  /** Хост, по которому ищется Project.domain, либо null. */
  host: string | null;
};

/**
 * Определяет сайт, с которого пришёл запрос. Сначала Origin (обычное подключение SDK с
 * домена Logsy), затем — только для доверенных доменов — Referer и заголовки прокси
 * (подключение через собственный прокси сайта, где Origin отсутствует).
 */
export function resolveRequestOrigin(req: Request): RequestOrigin {
  const origin = req.headers.get("origin");
  const originHost = originHostname(origin);
  if (origin && originHost) {
    // Поддомен доверенного домена сводим к самому домену: проект зарегистрирован по нему.
    return { origin, host: firstPartyDomain(originHost) ?? originHost };
  }

  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() === "http"
      ? "http"
      : "https";

  // Referer идёт первым: Host за прокси может оказаться 127.0.0.1, если в nginx для
  // этого location не задан proxy_set_header Host.
  const candidates = [
    originHostname(req.headers.get("referer")),
    headerHost(req.headers.get("x-forwarded-host")),
    headerHost(req.headers.get("host")),
  ];
  for (const candidate of candidates) {
    const domain = firstPartyDomain(candidate);
    if (domain) return { origin: `${proto}://${candidate}`, host: domain };
  }

  return { origin: null, host: null };
}
