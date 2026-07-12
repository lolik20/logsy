// Интеграция с Т-Кассой (T-Bank / Тинькофф Эквайринг).
// Документация метода Init: https://developer.tbank.ru/eacq/api/init
//
// Порядок работы:
//  1. Формируем платёж методом Init — получаем PaymentURL, на который
//     редиректим пользователя для оплаты.
//  2. В запрос кладём объект Receipt (чек по 54-ФЗ) с системой
//     налогообложения УСН и email пользователя для отправки чека.
//  3. После оплаты Т-Касса шлёт уведомление (нотификацию) на
//     NotificationURL — там активируем подписку.

import crypto from "crypto";

const API_URL = (process.env.TBANK_API_URL || "https://securepay.tinkoff.ru/v2").replace(/\/$/, "");
const TERMINAL_KEY = process.env.TBANK_TERMINAL_KEY || "";
const PASSWORD = process.env.TBANK_PASSWORD || "";

// Система налогообложения для чека. По умолчанию УСН «доходы».
// Допустимые значения Т-Кассы: osn | usn_income | usn_income_outcome |
// envd | esn | patent.
const TAXATION = process.env.TBANK_TAXATION || "usn_income";

/** Настроена ли интеграция (заданы ключ терминала и пароль). */
export function tbankConfigured(): boolean {
  return Boolean(TERMINAL_KEY && PASSWORD);
}

/**
 * Считает Token (подпись) запроса по правилам Т-Кассы:
 *  - берём только простые параметры корня (без вложенных Receipt/DATA и без
 *    самого Token);
 *  - добавляем пару Password;
 *  - сортируем по ключу, конкатенируем значения, берём SHA-256 в hex.
 * Булевы значения приводим к строкам "true"/"false" (для проверки нотификаций).
 */
export function computeToken(params: Record<string, unknown>): string {
  const entries: [string, string][] = [["Password", PASSWORD]];
  for (const [key, value] of Object.entries(params)) {
    if (key === "Token") continue;
    if (value === undefined || value === null) continue;
    if (typeof value === "object") continue; // Receipt, DATA и прочие вложенные — не участвуют
    entries.push([key, typeof value === "boolean" ? (value ? "true" : "false") : String(value)]);
  }
  entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const concatenated = entries.map(([, v]) => v).join("");
  return crypto.createHash("sha256").update(concatenated, "utf8").digest("hex");
}

/** Проверяет подпись пришедшей нотификации. */
export function verifyNotificationToken(body: Record<string, unknown>): boolean {
  const received = String(body.Token || "");
  if (!received) return false;
  const expected = computeToken(body);
  return received.toLowerCase() === expected.toLowerCase();
}

export type ReceiptItem = {
  Name: string;
  /** Цена за единицу в копейках. */
  Price: number;
  Quantity: number;
  /** Сумма позиции в копейках (Price * Quantity). */
  Amount: number;
  /** Ставка НДС. Для УСН — "none". */
  Tax: string;
};

export type InitParams = {
  /** Сумма платежа в копейках. */
  amountKopecks: number;
  orderId: string;
  description: string;
  /** Email покупателя — на него уйдёт чек. */
  email: string;
  items: ReceiptItem[];
  successUrl?: string;
  failUrl?: string;
  notificationUrl?: string;
};

export type InitResult = {
  Success: boolean;
  ErrorCode: string;
  TerminalKey?: string;
  Status?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  PaymentURL?: string;
  Message?: string;
  Details?: string;
};

/**
 * Создаёт платёж методом Init и возвращает ответ Т-Кассы с PaymentURL.
 * В запрос включается объект Receipt (УСН + email пользователя для чека).
 */
export async function initPayment(params: InitParams): Promise<InitResult> {
  if (!tbankConfigured()) {
    throw new Error("Т-Касса не настроена: заданы не все переменные окружения TBANK_*");
  }

  // Простые параметры корня — участвуют в расчёте Token.
  const flat: Record<string, string | number> = {
    TerminalKey: TERMINAL_KEY,
    Amount: params.amountKopecks,
    OrderId: params.orderId,
    Description: params.description,
  };
  if (params.successUrl) flat.SuccessURL = params.successUrl;
  if (params.failUrl) flat.FailURL = params.failUrl;
  if (params.notificationUrl) flat.NotificationURL = params.notificationUrl;

  const Token = computeToken(flat);

  const requestBody = {
    ...flat,
    Token,
    // Данные для отправки чека и уведомлений покупателю.
    DATA: { Email: params.email },
    // Чек по 54-ФЗ: система налогообложения УСН и email пользователя.
    Receipt: {
      Email: params.email,
      Taxation: TAXATION,
      Items: params.items,
    },
  };

  const res = await fetch(`${API_URL}/Init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  const data = (await res.json().catch(() => ({}))) as InitResult;
  return data;
}
