// Оповещения о сообщениях обратной формы ошибок (события USER_REPORT).
//
// Когда посетитель сайта проекта отправляет сообщение через плавающую кнопку
// «Сообщить об ошибке», оно приходит батчем на /api/logger/ingest. Помимо записи
// события в сессию, мы уведомляем владельца проекта на все его контакты (email и
// Telegram) — так же, как это делается для алертов мониторинга (см. src/lib/checker.ts).

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";

export type UserReport = { message: string | null; url: string | null };

/**
 * Уведомляет владельца проекта о новых сообщениях пользователей (USER_REPORT).
 * Best-effort: ошибки отправки логируются, но не мешают приёму логов. Вызывается
 * из ингеста в долгоживущем процессе (см. инструментацию), поэтому запускается
 * «в фоне» (без await), чтобы не задерживать ответ SDK.
 */
export async function notifyUserReports(
  projectId: string,
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

  for (const report of items) {
    const message = report.message!.trim();
    const page = report.url ?? "";
    const subject = `💬 Новое сообщение об ошибке · ${project.name}`;
    const text =
      `Проект: ${project.name} (${project.domain})\n` +
      (page ? `Страница: ${page}\n` : "") +
      `Время: ${when}\n` +
      `\nСообщение пользователя:\n${message}\n`;

    for (const contact of contacts) {
      try {
        if (contact.type === "TELEGRAM") {
          const html =
            `<b>💬 Сообщение об ошибке</b>\n` +
            `Проект: ${escapeHtml(project.name)} (${escapeHtml(project.domain)})\n` +
            (page ? `Страница: ${escapeHtml(page)}\n` : "") +
            `\n${escapeHtml(message)}`;
          await sendTelegramMessage(contact.value, html, { html: true });
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
