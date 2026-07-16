// Определение «статических» сетевых событий — общее для страницы сессии (где статика
// выносится в отдельную свёрнутую вкладку) и для аналитики топов (где статические
// JS/CSS-чанки не должны забивать топ медленных запросов). Статикой считаем замеры
// Resource Timing (SLOW_RESOURCE) и любые сетевые запросы к файлам со статическим
// расширением (JS-чанки, стили, картинки, шрифты — приходят как SLOW_REQUEST/HTTP_ERROR
// через обёртку fetch/XHR). Расширение берём из пути запроса (route) без query-строки.

import { endpointOf } from "@/lib/exceptions";

// Расширения статических файлов: скрипты, стили, картинки, шрифты, карты, wasm.
export const STATIC_ASSET_EXT =
  /\.(?:js|mjs|cjs|css|png|jpe?g|gif|svg|webp|avif|ico|bmp|woff2?|ttf|otf|eot|map|wasm)$/i;

/** Относится ли событие к статике (img/script/css/шрифты и т.п.)? */
export function isStaticAssetEvent(e: { type: string; route?: string | null }): boolean {
  if (e.type === "SLOW_RESOURCE") return true;
  const endpoint = endpointOf(e.route);
  return endpoint ? STATIC_ASSET_EXT.test(endpoint) : false;
}

// Подтип статического файла по расширению пути. Картинки/шрифты определяются по
// расширению однозначно, поэтому именно оно надёжнее, чем initiatorType из браузера.
const IMG_EXT = /\.(?:png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i;
const FONT_EXT = /\.(?:woff2?|ttf|otf|eot)$/i;
const SCRIPT_EXT = /\.(?:js|mjs|cjs)$/i;
const STYLE_EXT = /\.css$/i;

/** Подтип статического файла (img/font/script/css) по расширению пути или null. */
export function assetSubtypeFromRoute(route: string | null | undefined): string | null {
  const endpoint = endpointOf(route);
  if (!endpoint) return null;
  if (IMG_EXT.test(endpoint)) return "img";
  if (FONT_EXT.test(endpoint)) return "font";
  if (SCRIPT_EXT.test(endpoint)) return "script";
  if (STYLE_EXT.test(endpoint)) return "css";
  return null;
}

// Обобщённые/малополезные initiatorType, за которыми прячется реальный тип файла:
// «link» — ресурс из <link rel=preload/prefetch/stylesheet>, «other»/пусто — прочее.
// Для них показываем подтип по расширению (например, предзагруженный webp — как img).
const AMBIGUOUS_INITIATORS = new Set(["link", "other", "", "?"]);

/**
 * Нормализует подтип инициатора статического ресурса: если браузер отдал обобщённый
 * initiatorType («link» у preload/prefetch, «other»), но расширение однозначно
 * указывает на картинку/шрифт/скрипт/стиль — используем его. Иначе оставляем как есть.
 */
export function normalizeResourceInitiator(
  route: string | null | undefined,
  initiator: string | null | undefined,
): string | null {
  const raw = (initiator ?? "").trim();
  if (!AMBIGUOUS_INITIATORS.has(raw.toLowerCase())) return raw || null;
  return assetSubtypeFromRoute(route) ?? (raw || null);
}
