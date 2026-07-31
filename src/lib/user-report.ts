// Оповещения о сообщениях обратной формы ошибок (события USER_REPORT).
//
// Когда посетитель сайта проекта отправляет сообщение через плавающую кнопку
// «Сообщить об ошибке», оно приходит батчем на /api/logger/ingest. Помимо записи
// события в сессию, мы уведомляем владельца проекта на все его контакты (email и
// Telegram) — так же, как это делается для алертов мониторинга (см. src/lib/checker.ts).

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import {
  sendTelegramMessageWithId,
  setTelegramReplyMarkup,
  registerReplyTarget,
  replyCallbackData,
  escapeHtml,
} from "@/lib/telegram";

export type UserReport = {
  message: string | null;
  url: string | null;
  // Почта отправителя из обратной формы (если указана), null — не указана.
  email?: string | null;
  // Задача, заведённая по этому сообщению (см. createTasksFromReports). Нужна для
  // ответа из Telegram: он дописывается в переписку этой задачи.
  taskId?: string | null;
};

/**
 * Разрешает ответить посетителю письмом прямо из Telegram: привязывает отправленное
 * оповещение к обращению (ответ reply на него уйдёт письмом, см. handleReplyToReport) и
 * дорисовывает на сообщение кнопку «Ответить на почту» — она присылает приглашение с уже
 * открытым полем ответа. Клавиатуру ставим отдельным вызовом, потому что в callback_data
 * кнопки нужен id токена, а он заводится по message_id уже отправленного сообщения.
 * Best-effort: если что-то не вышло, оповещение всё равно доставлено.
 */
async function enableEmailReply(params: {
  projectId: string;
  taskId: string | null;
  email: string;
  chatId: string;
  messageId: number;
}): Promise<void> {
  const tokenId = await registerReplyTarget(params);
  if (!tokenId) return;
  await setTelegramReplyMarkup(params.chatId, params.messageId, [
    [{ text: "✉️ Ответить на почту", callback_data: replyCallbackData(tokenId) }],
  ]);
}

/** Базовый адрес панели Logsy (для ссылок на сессию в уведомлениях). */
function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

/** Ссылка на страницу сессии в панели логирования, либо null, если APP_URL не задан. */
function sessionLink(projectId: string, sessionId: string): string | null {
  const base = appUrl();
  if (!base) return null;
  return `${base}/dashboard/projects/${projectId}/logging/${sessionId}`;
}

/**
 * Уведомляет владельца проекта о новых сообщениях пользователей (USER_REPORT).
 * Best-effort: ошибки отправки логируются, но не мешают приёму логов. Вызывается
 * из ингеста в долгоживущем процессе (см. инструментацию), поэтому запускается
 * «в фоне» (без await), чтобы не задерживать ответ SDK. sessionId — сессия, в
 * которую попало сообщение: на неё в уведомлении даётся прямая ссылка.
 */
export async function notifyUserReports(
  projectId: string,
  sessionId: string,
  reports: UserReport[],
): Promise<void> {
  const items = reports.filter((r) => r.message && r.message.trim());
  if (items.length === 0) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true, domain: true },
  });
  if (!project) return;

  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  if (contacts.length === 0) return;

  const when = new Date().toLocaleString("ru-RU");
  const link = sessionLink(projectId, sessionId);

  for (const report of items) {
    const message = report.message!.trim();
    const page = report.url ?? "";
    const email = report.email?.trim() || "";
    const subject = `💬 Новое сообщение об ошибке · ${project.name}`;
    const text =
      `Проект: ${project.name} (${project.domain})\n` +
      (page ? `Страница: ${page}\n` : "") +
      (email ? `Почта отправителя: ${email}\n` : "") +
      `Время: ${when}\n` +
      `\nСообщение пользователя:\n${message}\n` +
      (link ? `\nСессия пользователя: ${link}\n` : "");

    for (const contact of contacts) {
      // Email рассылаем только на подтверждённые адреса (верификация контактов).
      if (contact.type === "EMAIL" && !contact.verified) continue;
      try {
        if (contact.type === "TELEGRAM") {
          const html =
            `<b>💬 Сообщение об ошибке</b>\n` +
            `Проект: ${escapeHtml(project.name)} (${escapeHtml(project.domain)})\n` +
            (page ? `Страница: ${escapeHtml(page)}\n` : "") +
            (email ? `Почта отправителя: ${escapeHtml(email)}\n` : "") +
            `\n${escapeHtml(message)}` +
            (link ? `\n\n<a href="${escapeHtml(link)}">Открыть сессию пользователя</a>` : "") +
            // Подсказка про ответ имеет смысл только когда есть куда отвечать.
            (email ? `\n\n↩️ Ответьте на это сообщение — текст уйдёт письмом отправителю.` : "");
          const messageId = await sendTelegramMessageWithId(contact.value, html, { html: true });
          if (email && messageId != null) {
            await enableEmailReply({
              projectId,
              taskId: report.taskId ?? null,
              email,
              chatId: contact.value,
              messageId,
            });
          }
        } else {
          await sendMail({ to: contact.value, subject, text });
        }
      } catch (err) {
        console.error(
          `[Logsy] Не удалось отправить уведомление о сообщении пользователя на ${contact.value}:`,
          err,
        );
      }
    }
  }
}
