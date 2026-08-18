// Сторонние счётчики, теги и рекламные пиксели (Яндекс.Метрика, Google Analytics/GTM,
// top.mail.ru и т.п.). Их запросы и скрипты — не часть сайта клиента: они попадают в
// сессии как медленные ресурсы/запросы и засоряют карту загрузки страниц и топы, хотя
// повлиять на них владелец сайта не может.
//
// Список используется в трёх точках:
//   • SDK (src/app/api/logger/sdk/route.ts) — такие события не собираются вовсе;
//   • ингест (src/app/api/logger/ingest/route.ts) — страховка от старого SDK в кэше
//     браузера (скрипт отдаётся с max-age=86400, обновится не сразу);
//   • отчёты (src/lib/pages.ts, src/lib/topIssues.ts) — уже накопленные события
//     не показываются в карте загрузки и топах.
//
// Намеренно НЕ считаем шумом функциональные сторонние ресурсы: шрифты (fonts.googleapis.com,
// fonts.gstatic.com), reCAPTCHA, карты, платёжки — они реально влияют на загрузку страницы
// и владелец сайта может от них отказаться. Свои домены добавляются игнор-листом проекта.

/** Домены счётчиков/рекламы: сам домен и любые его поддомены. */
export const TRACKER_DOMAINS = [
  // Яндекс: Метрика, РСЯ, AdFox.
  "mc.yandex.ru",
  "mc.yandex.com",
  "mc.yandex.by",
  "mc.yandex.kz",
  "mc.yandex.com.tr",
  "mc.admetrica.ru",
  "metrika.yandex.ru",
  "metrica.yandex.com",
  "yandexmetrica.com",
  "ymetrica1.com",
  "an.yandex.ru",
  "ads.yandex.ru",
  "bs.yandex.ru",
  "awaps.yandex.ru",
  "adfox.ru",
  "yandexadexchange.net",
  // Google: Analytics, Tag Manager, реклама.
  "google-analytics.com",
  "googletagmanager.com",
  "googletagservices.com",
  "googleoptimize.com",
  "googleadservices.com",
  "googlesyndication.com",
  "doubleclick.net",
  "analytics.google.com",
  "adservice.google.com",
  // Mail.ru / VK: счётчик top.mail.ru и рекламные пиксели.
  "top.mail.ru",
  "top-fwz1.mail.ru",
  "ad.mail.ru",
  "ads.mail.ru",
  "rs.mail.ru",
  "ads.vk.com",
  // Прочие счётчики и записи сессий.
  "counter.yadro.ru",
  "tns-counter.ru",
  "hotjar.com",
  "hotjar.io",
  "clarity.ms",
  "mouseflow.com",
  "mixpanel.com",
  "amplitude.com",
  "segment.io",
  "segment.com",
  "connect.facebook.net",
  "analytics.tiktok.com",
  "criteo.com",
  "criteo.net",
  "cloudflareinsights.com",
] as const;

/** Хост принадлежит счётчику/рекламе (сам домен или его поддомен)? */
export function isTrackerHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.+$/, "");
  for (const domain of TRACKER_DOMAINS) {
    if (h === domain || h.endsWith("." + domain)) return true;
  }
  return false;
}

/**
 * Адрес запроса/ресурса ведёт на сторонний счётчик? Относительные адреса — это всегда
 * свой сайт, поэтому база для разбора роли не играет.
 */
export function isTrackerUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return isTrackerHost(new URL(url, "https://logsy.invalid").hostname);
  } catch {
    return false;
  }
}

// Типы событий, у которых в route лежит адрес сетевого запроса или ресурса. Только их
// проверяем на «шум»: у OUTBOUND в route тоже адрес, но это реальный уход посетителя
// на другой сайт — его прятать нельзя.
const NETWORK_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SLOW_RESOURCE",
  "SLOW_REQUEST",
  "HTTP_ERROR",
]);

/** Событие — это запрос/ресурс стороннего счётчика (шум, который не надо показывать)? */
export function isTrackerEvent(e: { type: string; route?: string | null }): boolean {
  return NETWORK_EVENT_TYPES.has(e.type) && isTrackerUrl(e.route);
}
