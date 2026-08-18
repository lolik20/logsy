// Чистые функции агрегации для блока «Топ ошибок и медленных запросов» на вкладке
// логирования. Не ходят в БД: получают события за выбранный день и сворачивают их в
// топы. Ошибки группируются по сигнатуре (тип + сообщение, для сетевых — метод/путь/код),
// медленные запросы — по эндпоинту (путь без query). Статические ресурсы (JS/CSS/картинки)
// из топа медленных исключаются, чтобы чанки бандлера не забивали список (см. staticAssets).

import { endpointOf } from "@/lib/exceptions";
import { isStaticAssetEvent } from "@/lib/staticAssets";
import { isTrackerEvent } from "@/lib/trackers";

// Типы событий-ошибок: JS-ошибка, необработанный reject, ошибка сетевого запроса.
export const ERROR_TYPES = ["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"] as const;

// Минимальная структура события, достаточная для топов (совместима с LogEvent).
export type IssueEvent = {
  id: string;
  sessionId: string;
  type: string;
  message: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  url: string | null;
  reqBody: string | null;
  resBody: string | null;
  createdAt: Date;
};

/** Одна строка топа ошибок: сгруппированная по сигнатуре ошибка с числом повторов. */
export type TopError = {
  key: string;
  label: string; // человекочитаемая подпись строки
  type: string; // тип для иконки/бейджа
  statusCode: number | null;
  count: number;
  sessionId: string; // самая свежая сессия с этой ошибкой — для перехода
  // Детали самой свежей ошибки этой сигнатуры — для кнопки «Скопировать».
  message: string | null;
  page: string | null; // URL страницы
  method: string | null;
  requestUrl: string | null; // URL/маршрут запроса
  reqBody: string | null;
  resBody: string | null;
};

/** Одна строка топа медленных запросов: эндпоинт с числом обращений и длительностью. */
export type TopSlow = {
  endpoint: string;
  method: string | null;
  count: number;
  maxMs: number;
  avgMs: number;
  sessionId: string; // самая свежая сессия с этим запросом — для перехода
};

const ERROR_SET: ReadonlySet<string> = new Set(ERROR_TYPES);

/** Сигнатура ошибки для группировки: ключ (для Map) и подпись (для вывода). */
function errorSignature(e: IssueEvent): { key: string; label: string } {
  if (e.type === "HTTP_ERROR") {
    // Сетевая ошибка: метод + путь (без query) + код ответа.
    const ep = endpointOf(e.route) ?? e.route ?? e.url ?? "—";
    const method = e.method ? `${e.method} ` : "";
    const code = e.statusCode != null ? ` → ${e.statusCode}` : "";
    const label = `${method}${ep}${code}`;
    return { key: `HTTP_ERROR:${label}`, label };
  }
  // JS-ошибка / reject: первая строка сообщения (без стека).
  const msg = (e.message ?? e.type).trim();
  const firstLine = msg.split("\n")[0] || e.type;
  return { key: `${e.type}:${firstLine}`, label: firstLine };
}

/**
 * Топ ошибок за период: события-ошибки сворачиваются по сигнатуре и сортируются по
 * числу повторов (самые частые — первыми). Для перехода запоминается самая свежая
 * сессия: события должны приходить отсортированными по времени по убыванию.
 */
export function topErrors(events: IssueEvent[], limit = 10): TopError[] {
  const map = new Map<string, TopError>();
  for (const e of events) {
    if (!ERROR_SET.has(e.type)) continue;
    // Упавшие запросы сторонних счётчиков (Метрика, GA/GTM) — не ошибки сайта.
    if (isTrackerEvent(e)) continue;
    const { key, label } = errorSignature(e);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      // Первое (самое свежее) вхождение задаёт сессию для перехода и детали для копирования.
      map.set(key, {
        key,
        label,
        type: e.type,
        statusCode: e.statusCode,
        count: 1,
        sessionId: e.sessionId,
        message: e.message,
        page: e.url,
        method: e.method,
        requestUrl: e.route ?? e.url,
        reqBody: e.reqBody,
        resBody: e.resBody,
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/**
 * Топ медленных запросов за период: события SLOW_REQUEST (кроме статики) сворачиваются
 * по эндпоинту и сортируются по максимальной длительности (самые медленные — первыми).
 * Для перехода запоминается самая свежая сессия: события должны приходить отсортированными
 * по времени по убыванию.
 */
export function topSlowRequests(events: IssueEvent[], limit = 10): TopSlow[] {
  const map = new Map<string, TopSlow & { sumMs: number }>();
  for (const e of events) {
    if (e.type !== "SLOW_REQUEST") continue;
    if (isStaticAssetEvent(e)) continue;
    if (isTrackerEvent(e)) continue;
    const endpoint = endpointOf(e.route) ?? e.route ?? "—";
    const key = `${e.method ?? ""} ${endpoint}`;
    const dur = e.durationMs ?? 0;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.sumMs += dur;
      if (dur > existing.maxMs) existing.maxMs = dur;
    } else {
      // Первое (самое свежее) вхождение задаёт сессию для перехода.
      map.set(key, {
        endpoint,
        method: e.method,
        count: 1,
        maxMs: dur,
        avgMs: dur,
        sumMs: dur,
        sessionId: e.sessionId,
      });
    }
  }
  return Array.from(map.values())
    .map(({ sumMs, ...rest }) => ({ ...rest, avgMs: Math.round(sumMs / rest.count) }))
    .sort((a, b) => b.maxMs - a.maxMs)
    .slice(0, limit);
}
