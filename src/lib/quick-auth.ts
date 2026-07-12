import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Ссылка для быстрой авторизации живёт ограниченное время — её отправляют
// вместе с паролем в письме после регистрации.
const QUICK_AUTH_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// Префикс идентификатора в таблице VerificationToken, чтобы не пересекаться
// с токенами, которые может создавать сам Auth.js adapter.
const IDENTIFIER_PREFIX = "quick-auth:";

/**
 * Создаёт одноразовый токен быстрой авторизации для пользователя и сохраняет
 * его в таблице VerificationToken. Возвращает сам токен для вставки в ссылку.
 */
export async function createQuickAuthToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: IDENTIFIER_PREFIX + email.trim().toLowerCase(),
      token,
      expires: new Date(Date.now() + QUICK_AUTH_TTL_MS),
    },
  });
  return token;
}

/**
 * Проверяет и «сжигает» токен быстрой авторизации. Возвращает email владельца,
 * если токен валиден и не истёк, иначе null. Токен одноразовый — при успешной
 * проверке он удаляется.
 */
export async function consumeQuickAuthToken(
  token: string,
): Promise<string | null> {
  if (!token) return null;

  const record = await prisma.verificationToken.findUnique({
    where: { token },
  });
  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) return null;

  // Токен одноразовый — удаляем сразу, чтобы повторное использование было невозможно.
  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  if (record.expires.getTime() < Date.now()) return null;

  return record.identifier.slice(IDENTIFIER_PREFIX.length);
}

/** Собирает абсолютную ссылку быстрой авторизации. */
export function buildQuickAuthUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/login/quick?token=${token}`;
}
