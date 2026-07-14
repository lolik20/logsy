// Чистые функции игнор-листа сервиса логирования (без обращения к БД) — общие для
// сервера (приём событий, API) и клиента (модалка «В исключения»). Правило-исключение
// теперь описывается парой условий: категорией события (медленный запрос / ошибка) и
// условием по URL (содержит / равно), которые пользователь задаёт в модалке.

/** Категория события в исключениях: медленный запрос или ошибка. */
export type ExceptionKind = "SLOW_REQUEST" | "ERROR";
/** Режим сопоставления URL: подстрока или точное совпадение. */
export type UrlMode = "CONTAINS" | "EQUALS";

export const KIND_LABEL: Record<ExceptionKind, string> = {
  SLOW_REQUEST: "Медленный запрос",
  ERROR: "Ошибка",
};

export const URL_MODE_LABEL: Record<UrlMode, string> = {
  CONTAINS: "содержит",
  EQUALS: "равно",
};

/**
 * Endpoint из URL/маршрута — путь без query-строки и хэша. Используется в режиме
 * «равно» (сравнение по пути) и как значение по умолчанию для поля URL в модалке.
 */
export function endpointOf(route: string | null | undefined): string | null {
  if (!route) return null;
  const ep = route.split(/[?#]/)[0].trim();
  return ep || null;
}

/**
 * Категория события для исключений. SLOW_REQUEST — медленный запрос; ERROR — любая
 * ошибка (JS-ошибка, необработанный reject, ошибка запроса). Прочие типы (навигация,
 * клики, служебные) исключать нельзя — возвращает null.
 */
export function eventKind(type: string): ExceptionKind | null {
  if (type === "SLOW_REQUEST") return "SLOW_REQUEST";
  if (type === "ERROR" || type === "UNHANDLED_REJECTION" || type === "HTTP_ERROR") return "ERROR";
  return null;
}

/** URL события для сопоставления: адрес запроса (route), а если его нет — адрес страницы (url). */
export function eventUrl(e: { route?: string | null; url?: string | null }): string | null {
  const r = e.route?.trim();
  if (r) return r;
  const u = e.url?.trim();
  return u || null;
}

/** Значение по умолчанию для поля URL в модалке: endpoint события (путь без query). */
export function defaultExceptionUrl(e: { route?: string | null; url?: string | null }): string {
  const url = eventUrl(e);
  return endpointOf(url) ?? url ?? "";
}

export type ExceptionRule = { kind: string; urlMode: string; url: string };

/** Совпадает ли событие с правилом-исключением (категория события + условие по URL). */
export function matchesException(
  event: { type: string; route?: string | null; url?: string | null },
  rule: ExceptionRule,
): boolean {
  if (eventKind(event.type) !== rule.kind) return false;
  const url = eventUrl(event);
  if (!url) return false;
  if (rule.urlMode === "EQUALS") {
    return url === rule.url || endpointOf(url) === rule.url;
  }
  // CONTAINS — правило-подстрока.
  return url.includes(rule.url);
}
