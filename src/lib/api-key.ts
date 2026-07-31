// Ключи публичного HTTP-API проектов (вкладка «API» в панели).
//
// Приём логов с сайта проекта работает без ключа — там keyless-модель: проект
// определяется по заголовку Origin (см. /api/logger/ingest). Ключ нужен для обратной
// задачи — чтения данных снаружи (сессии и их события через /api/v1/*), где Origin
// доверять нельзя. Ключ хранится в Project.apiKey, выпускается лениво при первом
// открытии вкладки «API» и перевыпускается по кнопке.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Префикс ключа — чтобы его было видно в логах/секрет-сканерах как ключ Logsy. */
export const API_KEY_PREFIX = "lg_";

/** Новый случайный ключ API: префикс + 48 hex-символов (24 байта энтропии). */
export function generateApiKey(): string {
  return API_KEY_PREFIX + crypto.randomBytes(24).toString("hex");
}

/**
 * Возвращает ключ API проекта, выпуская его при первом обращении. Вызывается со
 * страницы вкладки «API», поэтому ключ у пользователя появляется сам — заводить его
 * отдельным действием не нужно.
 */
export async function ensureProjectApiKey(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { apiKey: true },
  });
  if (project?.apiKey) return project.apiKey;

  const apiKey = generateApiKey();
  await prisma.project.update({ where: { id: projectId }, data: { apiKey } });
  return apiKey;
}

/**
 * Перевыпускает ключ проекта: старый мгновенно перестаёт работать, интеграции нужно
 * перевести на новый. Возвращает новый ключ.
 */
export async function regenerateProjectApiKey(projectId: string): Promise<string> {
  const apiKey = generateApiKey();
  await prisma.project.update({ where: { id: projectId }, data: { apiKey } });
  return apiKey;
}

/**
 * Достаёт ключ из запроса: `Authorization: Bearer <key>` или `X-Api-Key: <key>`.
 * Возвращает null, если ключа нет.
 */
export function apiKeyFromRequest(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }
  const header = req.headers.get("x-api-key");
  return header?.trim() || null;
}

/** Проект, которому принадлежит ключ API из запроса, либо null. */
export async function projectByApiKey(req: Request) {
  const key = apiKeyFromRequest(req);
  if (!key) return null;
  return prisma.project.findUnique({
    where: { apiKey: key },
    select: { id: true, name: true, domain: true },
  });
}
