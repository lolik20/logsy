// Оповещения о rage-кликах в пользовательских сессиях (события RAGE_CLICK).
//
// Rage-клик — серия быстрых повторных кликов в одну точку: пользователь тыкает в
// элемент, который «не реагирует» (завис, не кликабелен, долго отвечает). Детектируется
// на клиенте в SDK (см. detectRage в src/app/api/logger/sdk/route.ts) и приходит в
// ингест обычным событием батча. Помимо записи в сессию мы уведомляем владельца проекта
// на все его контакты (email и Telegram) — так же, как это делается для ошибок
// (src/lib/error-alert.ts) и сообщений обратной формы (src/lib/user-report.ts).
//
// Троттлинг — ПОШТУЧНЫЙ: лимит «не чаще раза в час» действует на каждый отдельный
// проблемный элемент (совпадает подпись rageSignature: страница + описание элемента), а
// не на проект целиком. Заклинивший элемент, по которому пользователи бьются весь день,
// уведомит один раз в час, а rage-клик по другому месту — сразу. Часовой слот по каждой
// подписи занимается атомарно (см. claimAlertSlot в src/lib/alert-throttle.ts), поэтому
// параллельные батчи не задваивают отправку.

import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage, escapeHtml } from "@/lib/telegram";
import { endpointOf } from "@/lib/exceptions";
import { alertSignature, claimAlertSlot } from "@/lib/alert-throttle";

// Не чаще одного уведомления об одном и том же проблемном элементе в час.
const THROTTLE_MS = 60 * 60 * 1000;

// Сколько rage-кликов расписать подробно в теле уведомления (остальные — общим
// счётчиком). У Telegram лимит 4096 символов на сообщение, поэтому перечисляем немного.
const MAX_LISTED = 3;
// Максимальная длина отдельных полей в подробностях.
const TEXT_MAX = 300;

export type RageClick = {
  message: string | null;
  url: string | null;
};

/** Обрезает строку до n символов (с многоточием) и триммит; пустую строку → null. */
function clip(s: string | null | undefined, n: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > n ? `${t.slice(0, n)}…` : t;
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
 * Подпись rage-клика: одинаковая проблема → одинаковая подпись. Именно по ней действует
 * лимит «раз в час». Идентичность — это страница (путь без query, чтобы `?id=1` и
 * `?id=2` считались одним местом) плюс описание элемента из сообщения SDK. Числа в
 * сообщении обезличиваем: серия из 3 и из 5 кликов по одной кнопке — та же проблема, а
 * не две разные.
 */
export function rageSignature(e: RageClick): string {
  const page = endpointOf(e.url) ?? "";
  const what = (e.message ?? "").trim().replace(/\d+/g, "#");
  return alertSignature(`RAGE_CLICK|${page}|${what}`);
}

/** Подробный блок rage-клика в виде простого текста (для email). */
function rageBlockText(e: RageClick): string {
  const lines = [`• ${clip(e.message, TEXT_MAX) ?? "Rage-клик"}`];
  if (e.url) lines.push(`    Страница: ${e.url}`);
  return lines.join("\n");
}

/** Подробный блок rage-клика в HTML (для Telegram); значения экранируются. */
function rageBlockHtml(e: RageClick): string {
  const lines = [`• <b>${escapeHtml(clip(e.message, TEXT_MAX) ?? "Rage-клик")}</b>`];
  if (e.url) lines.push(`    ${escapeHtml("Страница")}: <code>${escapeHtml(e.url)}</code>`);
  return lines.join("\n");
}

/**
 * Уведомляет владельца проекта о rage-кликах в пользовательских сессиях.
 *
 * Лимит «раз в час» поштучный: один и тот же (по rageSignature) проблемный элемент
 * уведомляет не чаще раза в час, а rage-клик в другом месте — сразу. В одно
 * письмо/сообщение попадают те rage-клики батча, по которым слот удалось занять; если
 * уведомлять не о чем — не шлём ничего.
 *
 * Best-effort: ошибки отправки логируются, но не мешают приёму логов. Вызывается из
 * ингеста в долгоживущем процессе (см. инструментацию), поэтому запускается «в фоне»
 * (без await), чтобы не задерживать ответ SDK. sessionId — сессия, в которую попали
 * rage-клики: на неё в уведомлении даётся прямая ссылка.
 */
export async function notifyRageClicks(
  projectId: string,
  sessionId: string,
  events: RageClick[],
): Promise<void> {
  if (events.length === 0) return;

  // Схлопываем одинаковые rage-клики внутри батча по подписи (первое вхождение), чтобы
  // одна и та же проблема не занимала слот дважды за раз.
  const unique = new Map<string, RageClick>();
  for (const e of events) {
    const sig = rageSignature(e);
    if (!unique.has(sig)) unique.set(sig, e);
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true, domain: true },
  });
  if (!project) return;

  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  // Отправлять некому — не занимаем слоты (пусть уведомит следующий rage-клик, когда
  // появится контакт). Email — только на подтверждённые адреса.
  const sendable = contacts.filter((c) => c.type !== "EMAIL" || c.verified);
  if (sendable.length === 0) return;

  // Занимаем часовой слот по каждой проблеме: берём только новые или те, у которых час
  // прошёл. Повторы в пределах часа отсекаются здесь.
  const now = new Date();
  const toNotify: RageClick[] = [];
  for (const [signature, event] of unique) {
    if (await claimAlertSlot(projectId, signature, now, THROTTLE_MS)) toNotify.push(event);
  }
  if (toNotify.length === 0) return;

  const when = now.toLocaleString("ru-RU");
  const link = sessionLink(projectId, sessionId);
  const listed = toNotify.slice(0, MAX_LISTED);
  const more = toNotify.length - listed.length;

  const countLine =
    toNotify.length === 1
      ? "В сессии пользователя зафиксирован rage-клик — серия быстрых повторных кликов в одну точку. Обычно так делают, когда элемент не отвечает."
      : `В сессиях пользователей зафиксированы rage-клики (${toNotify.length}) — серии быстрых повторных кликов в одну точку. Обычно так делают, когда элемент не отвечает.`;

  const subject = `🖱️ Rage-клики на сайте · ${project.name}`;
  const text =
    `Проект: ${project.name} (${project.domain})\n` +
    `Время: ${when}\n\n` +
    `${countLine}\n\n` +
    listed.map(rageBlockText).join("\n\n") +
    (more > 0 ? `\n\n…и ещё ${more}` : "") +
    (link ? `\n\nСессия пользователя: ${link}\n` : "") +
    `\nО повторных rage-кликах по одному и тому же месту уведомляем не чаще раза в час.`;

  const html =
    `<b>🖱️ Rage-клики на сайте · ${escapeHtml(project.name)}</b>\n` +
    `Проект: ${escapeHtml(project.name)} (${escapeHtml(project.domain)})\n\n` +
    `${escapeHtml(countLine)}\n\n` +
    listed.map(rageBlockHtml).join("\n\n") +
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
        `[Logsy] Не удалось отправить уведомление о rage-кликах на ${contact.value}:`,
        err,
      );
    }
  }
}
