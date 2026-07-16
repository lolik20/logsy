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
