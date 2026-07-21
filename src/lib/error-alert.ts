// Оповещения об ошибках в пользовательских сессиях (события ERROR /
// UNHANDLED_REJECTION / HTTP_ERROR).
//
// Клиентский SDK на сайте проекта ловит фронт-ошибки и упавшие сетевые запросы и
// батчами шлёт их на /api/logger/ingest. Помимо записи событий в сессию, мы
// уведомляем владельца проекта на все его контакты (email и Telegram), когда в
// сессиях появляются ошибки — так же, как это делается для алертов мониторинга
// (см. src/lib/checker.ts) и для сообщений обратной формы (src/lib/user-report.ts).
//
// Чтобы поток ошибок не превращался в поток писем, уведомление шлётся НЕ ЧАЩЕ
// одного раза в час на проект: перед отправкой атомарно «занимаем» часовой слот
// через updateMany по Project.errorAlertSentAt (см. THROTTLE_MS ниже).

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";

// Типы событий, которые считаются ошибками (только ошибки — медленные запросы и
// прочие события SDK сюда не попадают). Совпадает с категорией ERROR в игнор-листе.
const ERROR_TYPES = new Set(["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"]);

// Не чаще одного уведомления об ошибках в час на проект.
const THROTTLE_MS = 60 * 60 * 1000;

// Сколько ошибок расписать подробно в теле уведомления (остальные — общим счётчиком).
// Подробные блоки объёмны, а у Telegram лимит 4096 символов на сообщение, поэтому
// перечисляем немного и обрезаем длинные поля (см. clip и *_MAX ниже).
const MAX_LISTED = 3;
// Максимальная длина отдельных полей в подробностях (тело запроса/ответа могут быть
// большими — усекаем, чтобы уведомление не раздувалось и влезало в лимит Telegram).
const BODY_MAX = 300;
const TEXT_MAX = 300;
const STACK_MAX = 300;

export type SessionError = {
  type: string;
  message: string | null;
  url: string | null;
  route: string | null;
  query: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  reqBody: string | null;
  resBody: string | null;
  stack: string | null;
};

/** Человекочитаемое название типа ошибки для тела уведомления. */
function errorTypeLabel(type: string): string {
  switch (type) {
    case "UNHANDLED_REJECTION":
      return "Необработанный промис";
    case "HTTP_ERROR":
      return "Ошибка запроса";
    default:
      return "JS-ошибка";
  }
}

/** Обрезает строку до n символов (с многоточием) и триммит; пустую строку → null. */
function clip(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

/** Первые несколько строк стека (для краткого следа JS-ошибки). */
function stackHead(stack: string | null, lines = 3): string | null {
  return clip(stack ? stack.split("\n").slice(0, lines).join("\n") : null, STACK_MAX);
}

/** Заголовок блока ошибки: «[Тип код] сообщение/маршрут». */
function errorHeader(e: SessionError): string {
  const label = errorTypeLabel(e.type);
  const status = e.type === "HTTP_ERROR" && e.statusCode ? ` ${e.statusCode}` : "";
  const what = clip(e.message || e.route, TEXT_MAX) || "";
  return `[${label}${status}] ${what}`.trim();
}

/**
 * Подробности одной ошибки как пары «Поле: значение»: страница, запрос (метод +
 * маршрут), код ответа, параметры запроса, тело запроса пользователя, ответ сервера,
 * длительность и след стека. Пустые поля опускаются.
 */
function errorDetails(e: SessionError): [string, string][] {
  const details: [string, string][] = [];
  if (e.url) details.push(["Страница", e.url]);
  const request = `${e.method ? `${e.method} ` : ""}${e.route ?? ""}`.trim();
  if (request) details.push(["Запрос", request]);
  if (e.statusCode) details.push(["Код ответа", String(e.statusCode)]);
  const query = clip(e.query, TEXT_MAX);
  if (query) details.push(["Параметры запроса", query]);
  const reqBody = clip(e.reqBody, BODY_MAX);
  if (reqBody) details.push(["Тело запроса", reqBody]);
  const resBody = clip(e.resBody, BODY_MAX);
  if (resBody) details.push(["Ответ сервера", resBody]);
  if (typeof e.durationMs === "number") details.push(["Длительность", `${e.durationMs} мс`]);
  // След стека — только для клиентских исключений (у HTTP-ошибок его нет).
  if (e.type !== "HTTP_ERROR") {
    const stack = stackHead(e.stack);
    if (stack) details.push(["Стек", stack]);
  }
  return details;
}

/** Подробный блок ошибки в виде простого текста (для email). */
function errorBlockText(e: SessionError): string {
  const lines = [`• ${errorHeader(e)}`];
  for (const [label, value] of errorDetails(e)) {
    // Многострочные значения (стек, тело) выводим с отступом на каждой строке.
    const indented = value.split("\n").join("\n      ");
    lines.push(`    ${label}: ${indented}`);
  }
  return lines.join("\n");
}

/** Подробный блок ошибки в HTML (для Telegram); значения экранируются. */
function errorBlockHtml(e: SessionError): string {
  const lines = [`• <b>${escapeHtml(errorHeader(e))}</b>`];
  for (const [label, value] of errorDetails(e)) {
    lines.push(`    ${escapeHtml(label)}: <code>${escapeHtml(value)}</code>`);
  }
  return lines.join("\n");
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
 * Уведомляет владельца проекта об ошибках в пользовательских сессиях.
 *
 * Только ошибки (ERROR / UNHANDLED_REJECTION / HTTP_ERROR) и не чаще раза в час на
 * проект. Часовой слот занимается атомарно (updateMany по errorAlertSentAt), поэтому
 * при параллельных батчах уведомление уйдёт только по одному из них.
 *
 * Best-effort: ошибки отправки логируются, но не мешают приёму логов. Вызывается из
 * ингеста в долгоживущем процессе (см. инструментацию), поэтому запускается «в фоне»
 * (без await), чтобы не задерживать ответ SDK. sessionId — сессия, в которую попали
 * ошибки: на неё в уведомлении даётся прямая ссылка.
 */
export async function notifySessionErrors(
  projectId: string,
  sessionId: string,
  events: SessionError[],
): Promise<void> {
  const errors = events.filter((e) => ERROR_TYPES.has(e.type));
  if (errors.length === 0) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true, domain: true },
  });
  if (!project) return;

  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  // Отправлять некому — не занимаем часовой слот (пусть уведомит следующая ошибка,
  // когда контакт появится). Email — только на подтверждённые адреса.
  const sendable = contacts.filter((c) => c.type !== "EMAIL" || c.verified);
  if (sendable.length === 0) return;

  // Атомарно занимаем часовой слот: обновится только если с прошлой отправки прошёл
  // час (или уведомлений ещё не было). count === 0 — час не прошёл, выходим тихо.
  const now = new Date();
  const threshold = new Date(now.getTime() - THROTTLE_MS);
  const claim = await prisma.project.updateMany({
    where: {
      id: projectId,
      OR: [{ errorAlertSentAt: null }, { errorAlertSentAt: { lt: threshold } }],
    },
    data: { errorAlertSentAt: now },
  });
  if (claim.count === 0) return;

  const when = now.toLocaleString("ru-RU");
  const link = sessionLink(projectId, sessionId);
  const listed = errors.slice(0, MAX_LISTED);
  const more = errors.length - listed.length;

  const countLine =
    errors.length === 1
      ? "В сессии пользователя зафиксирована ошибка."
      : `В сессиях пользователей зафиксированы ошибки (${errors.length}).`;

  const subject = `⚠️ Ошибки на сайте · ${project.name}`;
  const text =
    `Проект: ${project.name} (${project.domain})\n` +
    `Время: ${when}\n\n` +
    `${countLine}\n\n` +
    listed.map(errorBlockText).join("\n\n") +
    (more > 0 ? `\n\n…и ещё ${more}` : "") +
    (link ? `\n\nСессия пользователя: ${link}\n` : "") +
    `\nСледующее уведомление об ошибках — не раньше чем через час.`;

  const html =
    `<b>⚠️ Ошибки на сайте · ${escapeHtml(project.name)}</b>\n` +
    `Проект: ${escapeHtml(project.name)} (${escapeHtml(project.domain)})\n\n` +
    `${escapeHtml(countLine)}\n\n` +
    listed.map(errorBlockHtml).join("\n\n") +
    (more > 0 ? `\n\n…и ещё ${more}` : "") +
    (link ? `\n\n<a href="${escapeHtml(link)}">Открыть сессию пользователя</a>` : "");

  for (const contact of sendable) {
    try {
      if (contact.type === "TELEGRAM") {
        await sendTelegramMessage(contact.value, html, { html: true });
      } else {
        await sendMail({ to: contact.value, subject, text });
      }
    } catch (err) {
      console.error(
        `[Logsy] Не удалось отправить уведомление об ошибках на ${contact.value}:`,
        err,
      );
    }
  }
}
