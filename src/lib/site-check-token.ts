// Одноразовый по времени токен для публичной проверки сайта.
//
// Обход стоит дорого — держит Chromium до 40 секунд, — поэтому эндпоинт не должен быть
// открытым API, который дёргают скриптом. Страница /site-check при рендере выдаёт токен,
// форма отправляет его вместе с адресом, а сервер проверяет подпись и срок.
//
// Это не защита от целенаправленного абьюза (токен можно получить, открыв страницу), а
// отсечение самого дешёвого сценария: curl в цикле по списку доменов. От остального
// защищают лимиты по IP и домену в самом роуте.

import crypto from "crypto";

/** Сколько живёт выданный токен: страница может повисеть открытой, но не сутки. */
const TTL_MS = 30 * 60_000;

/** Ключ подписи. Отдельного секрета не заводим — берём общий серверный. */
function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.CRON_SECRET || "logsy-site-check";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Выдаёт токен вида «срок.подпись». Вызывается при рендере страницы. */
export function issueCheckToken(now = Date.now()): string {
  const expires = String(now + TTL_MS);
  return `${expires}.${sign(expires)}`;
}

/** Проверяет подпись и срок токена. */
export function verifyCheckToken(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature) return false;
  const expected = sign(expires);
  // Сравнение постоянного времени: длины совпадают, иначе timingSafeEqual бросит.
  if (signature.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
  const ts = Number(expires);
  return Number.isFinite(ts) && ts > now;
}
