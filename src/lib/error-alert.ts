// Оповещения об ошибках в пользовательских сессиях (события ERROR /
// UNHANDLED_REJECTION / HTTP_ERROR).
//
// Клиентский SDK на сайте проекта ловит фронт-ошибки и упавшие сетевые запросы и
// батчами шлёт их на /api/logger/ingest. Помимо записи событий в сессию, мы
// уведомляем владельца проекта на все его контакты (email и Telegram), когда в
// сессиях появляются ошибки — так же, как это делается для алертов мониторинга
// (см. src/lib/checker.ts) и для сообщений обратной формы (src/lib/user-report.ts).
//
// Троттлинг — ПОШТУЧНЫЙ: лимит «не чаще раза в час» действует на каждую отдельную
// (одинаковую) ошибку, а не на проект целиком. Одна и та же ошибка (совпадает подпись
// errorSignature) уведомляет не чаще раза в час; другая, непохожая ошибка уведомляет
// сразу, без общего лимита. Часовой слот по каждой подписи занимается атомарно через
// таблицу ErrorAlert (см. claimError ниже), поэтому параллельные батчи не задваивают
// отправку одной и той же ошибки.

import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";

// Типы событий, которые считаются ошибками (только ошибки — медленные запросы и
// прочие события SDK сюда не попадают). Совпадает с категорией ERROR в игнор-листе.
const ERROR_TYPES = new Set(["ERROR", "UNHANDLED_REJECTION", "HTTP_ERROR"]);

// Не чаще одного уведомления об одной и той же ошибке в час.
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
 * Подпись ошибки: одинаковые ошибки → одинаковая подпись. Именно по ней действует
 * лимит «раз в час». Для JS-исключений идентичность — это тип + сообщение (без
 * изменчивых деталей вроде тела/страницы); для HTTP-ошибок — код + метод + путь
 * запроса БЕЗ query-строки (чтобы `?id=1` и `?id=2` считались одной ошибкой).
 */
export function errorSignature(e: SessionError): string {
  let key: string;
  if (e.type === "HTTP_ERROR") {
    const path = (e.route ?? "").split(/[?#]/)[0];
    key = `HTTP_ERROR|${e.statusCode ?? ""}|${(e.method ?? "").toUpperCase()}|${path}`;
  } else {
    key = `${e.type}|${(e.message ?? "").trim()}`;
  }
  return createHash("sha1").update(key).digest("hex");
}

/**
 * Атомарно «занимает» часовой слот для одной подписи ошибки. Возвращает true, если по
 * этой ошибке пора уведомлять (её ещё не видели или с прошлого уведомления прошёл час),
 * и false, если уведомление о ней уже уходило меньше часа назад.
 *
 * Гонка исключена: сначала пробуем условный update (пройдёт только у одного процесса,
 * если час прошёл), а если строки ещё нет — пробуем create (уникальный индекс
 * пропустит только одного; проигравший ловит P2002 и молчит).
 */
async function claimError(projectId: string, signature: string, now: Date): Promise<boolean> {
  const threshold = new Date(now.getTime() - THROTTLE_MS);
  const updated = await prisma.errorAlert.updateMany({
    where: { projectId, signature, lastSentAt: { lt: threshold } },
    data: { lastSentAt: now },
  });
  if (updated.count > 0) return true;
  try {
    await prisma.errorAlert.create({ data: { projectId, signature, lastSentAt: now } });
    return true; // ошибка встретилась впервые — уведомляем
  } catch (err) {
    // P2002 — строка уже есть и час не прошёл: недавно уведомляли, пропускаем.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return false;
    }
    throw err;
  }
}

/**
 * Уведомляет владельца проекта об ошибках в пользовательских сессиях.
 *
 * Только ошибки (ERROR / UNHANDLED_REJECTION / HTTP_ERROR). Лимит «раз в час» —
 * поштучный: одинаковая (по errorSignature) ошибка уведомляет не чаще раза в час, а
 * непохожие ошибки уведомляют сразу. В одно письмо/сообщение попадают только те
 * ошибки батча, по которым слот удалось занять; если таких нет — не шлём ничего.
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

  // Схлопываем одинаковые ошибки внутри батча по подписи (первое вхождение +
  // счётчик повторов), чтобы одинаковая ошибка не занимала слот дважды за раз.
  const unique = new Map<string, { error: SessionError; count: number }>();
  for (const e of errors) {
    const sig = errorSignature(e);
    const seen = unique.get(sig);
    if (seen) seen.count += 1;
    else unique.set(sig, { error: e, count: 1 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true, domain: true },
  });
  if (!project) return;

  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  // Отправлять некому — не занимаем слоты (пусть уведомит следующая ошибка, когда
  // появится контакт). Email — только на подтверждённые адреса.
  const sendable = contacts.filter((c) => c.type !== "EMAIL" || c.verified);
  if (sendable.length === 0) return;

  // Занимаем часовой слот по каждой уникальной ошибке; в уведомление берём только те,
  // по которым слот удалось занять (новые или «час прошёл»). Повторяющиеся в пределах
  // часа отсекаются здесь.
  const now = new Date();
  const toNotify: SessionError[] = [];
  for (const { error } of unique.values()) {
    if (await claimError(projectId, errorSignature(error), now)) toNotify.push(error);
  }
  if (toNotify.length === 0) return;

  const when = now.toLocaleString("ru-RU");
  const link = sessionLink(projectId, sessionId);
  const listed = toNotify.slice(0, MAX_LISTED);
  const more = toNotify.length - listed.length;

  const countLine =
    toNotify.length === 1
      ? "В сессии пользователя зафиксирована ошибка."
      : `В сессиях пользователей зафиксированы ошибки (${toNotify.length}).`;

  const subject = `⚠️ Ошибки на сайте · ${project.name}`;
  const text =
    `Проект: ${project.name} (${project.domain})\n` +
    `Время: ${when}\n\n` +
    `${countLine}\n\n` +
    listed.map(errorBlockText).join("\n\n") +
    (more > 0 ? `\n\n…и ещё ${more}` : "") +
    (link ? `\n\nСессия пользователя: ${link}\n` : "") +
    `\nО каждой из этих ошибок повторно уведомим не раньше чем через час; о новых, ещё не встречавшихся ошибках — сразу.`;

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
