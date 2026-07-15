import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

// Ссылка подтверждения email-канала уведомлений живёт ограниченное время.
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// Префикс идентификатора в таблице VerificationToken, чтобы не пересекаться с
// токенами Auth.js, быстрой авторизации и сброса пароля. В идентификаторе — id контакта.
const IDENTIFIER_PREFIX = "contact-verify:";

/** Создаёт одноразовый токен подтверждения email-контакта. Возвращает токен для ссылки. */
export async function createContactVerificationToken(contactId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: IDENTIFIER_PREFIX + contactId,
      token,
      expires: new Date(Date.now() + VERIFY_TTL_MS),
    },
  });
  return token;
}

/**
 * Проверяет и «сжигает» токен подтверждения контакта. Возвращает id контакта, если токен
 * валиден и не истёк, иначе null. Токен одноразовый — удаляется при проверке.
 */
export async function consumeContactVerificationToken(token: string): Promise<string | null> {
  if (!token) return null;

  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record || !record.identifier.startsWith(IDENTIFIER_PREFIX)) return null;

  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  if (record.expires.getTime() < Date.now()) return null;

  return record.identifier.slice(IDENTIFIER_PREFIX.length);
}

/** Абсолютная ссылка на страницу подтверждения email-канала. */
export function buildContactVerificationUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/verify-contact?token=${token}`;
}

/**
 * Создаёт токен и отправляет письмо со ссылкой подтверждения на email-контакт. Используется
 * при добавлении email-канала и при повторной отправке письма из панели.
 */
export async function sendContactVerification(contact: {
  id: string;
  value: string;
}): Promise<void> {
  const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000";
  const token = await createContactVerificationToken(contact.id);
  const url = buildContactVerificationUrl(appUrl, token);

  await sendMail({
    to: contact.value,
    subject: "Подтвердите email для алертов Logsy",
    text:
      `Здравствуйте!\n\n` +
      `Этот адрес добавлен как канал уведомлений в Logsy.\n\n` +
      `Чтобы получать алерты на этот email, подтвердите адрес по ссылке ` +
      `(действует 24 часа):\n  ${url}\n\n` +
      `Если вы не добавляли этот адрес — просто проигнорируйте письмо.\n\n` +
      `— Команда Logsy`,
  });
}
