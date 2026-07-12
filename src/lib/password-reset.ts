import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Ссылка для сброса пароля живёт ограниченное время — её отправляют письмом
// по запросу пользователя со страницы «Забыли пароль?».
const RESET_TTL_MS = 60 * 60 * 1000; // 1 час

// Префикс идентификатора в таблице VerificationToken, чтобы не пересекаться
// с токенами Auth.js adapter и токенами быстрой авторизации.
const IDENTIFIER_PREFIX = "password-reset:";

/**
 * Создаёт одноразовый токен сброса пароля для пользователя и сохраняет его в
 * таблице VerificationToken. Возвращает сам токен для вставки в ссылку.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: IDENTIFIER_PREFIX + email.trim().toLowerCase(),
      token,
      expires: new Date(Date.now() + RESET_TTL_MS),
    },
  });
  return token;
}

/**
 * Проверяет и «сжигает» токен сброса пароля. Возвращает email владельца, если
 * токен валиден и не истёк, иначе null. Токен одноразовый — при успешной
 * проверке он удаляется.
 */
export async function consumePasswordResetToken(
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

/** Собирает абсолютную ссылку на страницу сброса пароля. */
export function buildPasswordResetUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/reset-password?token=${token}`;
}
