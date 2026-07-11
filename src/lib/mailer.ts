import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== "false",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  });

  return transporter;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Отправляет письмо через SMTP. Если SMTP не сконфигурирован (нет SMTP_HOST),
 * письмо выводится в консоль сервера — это dev-режим «из коробки».
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = process.env.SMTP_FROM || "Logsy <no-reply@logsy.ru>";
  const tx = getTransporter();

  if (!tx) {
    console.log(
      "\n===== [Logsy] EMAIL (SMTP не настроен, вывод в консоль) =====\n" +
        `From:    ${from}\n` +
        `To:      ${message.to}\n` +
        `Subject: ${message.subject}\n` +
        `---\n${message.text}\n` +
        "============================================================\n",
    );
    return;
  }

  await tx.sendMail({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
