// Извлечение IP-адреса клиента из входящего запроса.
// За приложением обычно стоит прокси/балансировщик, поэтому реальный адрес
// приходит в заголовках X-Forwarded-For / X-Real-IP.

/**
 * Возвращает IP клиента или null, если определить не удалось.
 * Берём первый адрес из X-Forwarded-For (клиентский), иначе X-Real-IP.
 */
export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  return null;
}
