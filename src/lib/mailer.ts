import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 2525),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        }
      : undefined,
  });

  return transporter;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  // CID для встраивания картинки в HTML (<img src="cid:...">).
  cid?: string;
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  // Адрес для ответа получателя (Reply-To). Используется, например, в переписке по
  // задачам: письмо уходит с технического SMTP_FROM, но ответ пользователя должен
  // прийти на почту владельца проекта.
  replyTo?: string;
  // Переопределение From (по умолчанию SMTP_FROM).
  from?: string;
  // Дополнительные SMTP-заголовки (например, List-Unsubscribe для холодной рассылки).
  headers?: Record<string, string>;
  // Вложения, в т.ч. встроенные картинки по CID.
  attachments?: MailAttachment[];
}

/**
 * Отправляет письмо через SMTP. Если SMTP не сконфигурирован (нет SMTP_HOST),
 * письмо выводится в консоль сервера.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = message.from || process.env.SMTP_FROM || "Logsy <no-reply@logsy.ru>";
  const tx = getTransporter();

  if (!tx) {
    console.log(
      "\n===== [Logsy] EMAIL (SMTP не настроен, вывод в консоль) =====\n" +
        `From:    ${from}\n` +
        `To:      ${message.to}\n` +
        `Subject: ${message.subject}\n` +
        (message.replyTo ? `Reply-To: ${message.replyTo}\n` : "") +
        (message.headers
          ? Object.entries(message.headers)
              .map(([k, v]) => `${k}: ${v}\n`)
              .join("")
          : "") +
        (message.attachments?.length
          ? `Attachments: ${message.attachments.map((a) => a.filename).join(", ")}\n`
          : "") +
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
    replyTo: message.replyTo,
    headers: message.headers,
    attachments: message.attachments,
  });
}
