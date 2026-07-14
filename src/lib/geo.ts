// Геолокация по IP: определение страны пользователя для показа флага рядом с IP.
//
// Определяем страну один раз — при создании новой сессии на приёме событий (ingest),
// и сохраняем ISO-код в LogSession.country. На рендере дашборда флаг рисуется из этого
// кода (эмодзи, без картинок), поэтому повторных обращений к внешнему сервису нет —
// это важно из-за автообновления вкладки логирования.

// Провайдер без ключа и по HTTPS. Возвращает { country_code: "RU", success: true }.
const GEO_URL = (ip: string) =>
  `https://ipwho.is/${encodeURIComponent(ip)}?fields=success,country_code`;

// Тайм-аут, чтобы медленный внешний сервис не задерживал приём логов.
const GEO_TIMEOUT_MS = 1500;

// Кэш в памяти инстанса: один IP не опрашиваем повторно, пока процесс жив.
const cache = new Map<string, string | null>();

/** Приватный/локальный/неопределённый адрес — страну не ищем. */
function isPrivateIp(ip: string): boolean {
  if (!ip) return true;
  const v = ip.trim().toLowerCase();
  if (v === "::1" || v === "localhost") return true;
  // IPv4-приватные и loopback диапазоны.
  if (/^10\./.test(v)) return true;
  if (/^127\./.test(v)) return true;
  if (/^192\.168\./.test(v)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(v)) return true;
  if (/^169\.254\./.test(v)) return true;
  // IPv6 loopback/unique-local/link-local.
  if (/^(fc|fd|fe80)/.test(v)) return true;
  return false;
}

/**
 * Возвращает ISO-3166 alpha-2 код страны по IP (например "RU") или null, если
 * определить не удалось. Ошибки/тайм-аут внешнего сервиса не пробрасываются —
 * геолокация опциональна и не должна ломать приём логов.
 */
export async function resolveCountry(ip: string | null | undefined): Promise<string | null> {
  if (!ip || isPrivateIp(ip)) return null;
  if (cache.has(ip)) return cache.get(ip) ?? null;

  let code: string | null = null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), GEO_TIMEOUT_MS);
    const res = await fetch(GEO_URL(ip), { signal: ctrl.signal }).finally(() =>
      clearTimeout(timer),
    );
    if (res.ok) {
      const data = (await res.json()) as { success?: boolean; country_code?: string };
      const cc = data?.country_code;
      if (data?.success && typeof cc === "string" && /^[A-Za-z]{2}$/.test(cc)) {
        code = cc.toUpperCase();
      }
    }
  } catch {
    // Сеть/тайм-аут/парсинг — оставляем null.
  }

  cache.set(ip, code);
  return code;
}

/**
 * Эмодзи-флаг из ISO alpha-2 кода страны (буквы → regional indicator symbols).
 * Пустая строка, если код невалиден — вызывающий сам решает, что показать вместо флага.
 */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return "";
  const cc = code.toUpperCase();
  return String.fromCodePoint(
    ...[...cc].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)),
  );
}
