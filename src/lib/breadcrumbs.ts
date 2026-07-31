// Чистые функции «хлебных крошек» (breadcrumbs) сервиса логирования: последние действия
// пользователя перед отказом. «Отказ» = уход с сайта (событие SESSION_END, которое SDK
// пушит на pagehide). «Действие пользователя» — клик, ввод, переход по сайту или уход на
// другой сайт (OUTBOUND — последняя крошка показывает, куда именно ушли). Функции не ходят
// в БД и используются и на странице аналитики, и в просмотре сессии (подсветка крошек).

// Типы событий, считающиеся осмысленным действием пользователя (в порядке появления в
// логе они и образуют цепочку перед уходом).
export const ACTION_TYPES = ["CLICK", "INPUT", "NAVIGATION", "OUTBOUND"] as const;

// Сколько последних действий фиксируем перед отказом.
export const MAX_BREADCRUMBS = 3;

// Минимальная структура события, достаточная для разбора крошек (совместима с LogEvent).
export type BreadcrumbEvent = {
  id: string;
  type: string;
  message: string | null;
  url: string | null;
  createdAt: Date;
};

const ACTION_SET: ReadonlySet<string> = new Set(ACTION_TYPES);

/** Является ли тип события действием пользователя (клик/ввод/переход). */
export function isUserAction(type: string): boolean {
  return ACTION_SET.has(type);
}

/** Является ли событие отказом (уходом с сайта). */
export function isDeparture(type: string): boolean {
  return type === "SESSION_END";
}

/** Путь из URL (без схемы/хоста/query), либо null. */
function pathOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).pathname || "/";
  } catch {
    // Уже путь или мусор — отбрасываем query/хэш.
    const p = String(url).split(/[?#]/)[0].trim();
    return p || null;
  }
}

/**
 * Стабильная метка действия для группировки в аналитике. Значения полей ввода и
 * query-строки переходов отбрасываем, иначе одинаковые по смыслу действия не
 * схлопываются в одну группу.
 */
export function normalizeActionLabel(e: Pick<BreadcrumbEvent, "type" | "message" | "url">): string {
  if (e.type === "INPUT") {
    // «Ввод: name = value» → «Ввод: name» (значение выкидываем).
    const msg = e.message ?? "Ввод";
    const cut = msg.indexOf(" = ");
    return cut >= 0 ? msg.slice(0, cut) : msg;
  }
  if (e.type === "NAVIGATION") {
    // «Переход: <pathname>» — путь без query. Берём из url, иначе из текста сообщения.
    const path = pathOf(e.url) ?? (e.message ? e.message.replace(/^[^:]*:\s*/, "").split(/[?#]/)[0] : null);
    return "Переход: " + (path ?? "—");
  }
  if (e.type === "OUTBOUND") {
    // «Переход на другой сайт: host/path» → оставляем только домен: пути с реферальными
    // идентификаторами уникальны и в одну группу иначе не схлопнутся.
    const msg = e.message ?? "Переход на другой сайт";
    const cut = msg.indexOf(": ");
    return cut < 0 ? msg : msg.slice(0, cut + 2) + msg.slice(cut + 2).split("/")[0];
  }
  // CLICK и прочее — сообщение как есть (в нём уже <тег>#id «подпись»).
  return e.message ?? e.type;
}

/** Страница ухода: путь из url события SESSION_END, фолбэк — текст после «Выход с сайта: ». */
export function exitPage(e: Pick<BreadcrumbEvent, "message" | "url">): string {
  const path = pathOf(e.url);
  if (path) return path;
  if (e.message) {
    const idx = e.message.indexOf(": ");
    const rest = idx >= 0 ? e.message.slice(idx + 2) : e.message;
    return pathOf(rest) ?? rest ?? "—";
  }
  return "—";
}

/**
 * До `n` последних действий пользователя, идущих перед событием с индексом `endIndex`
 * в хронологическом (по возрастанию времени) массиве событий сессии. Результат — в
 * хронологическом порядке (самое раннее первым).
 */
export function breadcrumbsBefore<T extends { type: string }>(
  events: T[],
  endIndex: number,
  n: number = MAX_BREADCRUMBS,
): T[] {
  const out: T[] = [];
  for (let i = endIndex - 1; i >= 0 && out.length < n; i--) {
    if (isUserAction(events[i].type)) out.push(events[i]);
  }
  return out.reverse();
}

/** Один зафиксированный уход с сайта и предшествующие ему действия пользователя. */
export type Departure = {
  sessionId: string;
  at: Date;
  exitPage: string;
  // Действия в хронологическом порядке (самое раннее первым), максимум MAX_BREADCRUMBS.
  actions: BreadcrumbEvent[];
};

/**
 * Собирает реальный уход из событий ОДНОЙ сессии (отсортированных по времени).
 *
 * Реальным уходом считаем только ПОСЛЕДНЕЕ событие SESSION_END сессии. Промежуточные
 * SESSION_END — это выгрузки страницы при переходе на другую страницу того же сайта
 * (многостраничные сайты): после них сессия продолжалась, отказом они не являются.
 * Учёт только последнего убирает дублирование крошек «перед уходом» в нескольких местах
 * ленты (в т.ч. для старых сессий, записанных до исправления в SDK).
 *
 * Возвращает массив (0 или 1 элемент), чтобы вызывающий код не менялся.
 */
export function collectDepartures<T extends BreadcrumbEvent & { sessionId: string }>(
  events: T[],
): Departure[] {
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (!isDeparture(e.type)) continue;
    return [
      {
        sessionId: e.sessionId,
        at: e.createdAt,
        exitPage: exitPage(e),
        actions: breadcrumbsBefore(events, i),
      },
    ];
  }
  return [];
}

/** id последнего SESSION_END сессии (реального ухода), либо null. */
export function departureEventId<T extends BreadcrumbEvent>(events: T[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    if (isDeparture(events[i].type)) return events[i].id;
  }
  return null;
}
