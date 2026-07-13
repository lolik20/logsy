import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage } from "@/lib/telegram";
import { isServiceActive } from "@/lib/subscription";
import { runDueProjectSslChecks } from "@/lib/ssl-checker";

export const INTERVAL_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
};

type MonitorRow = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  port: number | null;
  method: string;
  interval: string;
  expectedStatus: number;
  timeoutMs: number;
  headers: string | null;
  bodyType: string;
  body: string | null;
  lastStatus: string;
  lastCheckedAt: Date | null;
};

const CONTENT_TYPE: Record<string, string> = {
  JSON: "application/json",
  XML: "application/xml",
  FORM: "application/x-www-form-urlencoded",
};

/** Собирает заголовки и тело запроса из настроек монитора. */
function buildRequestInit(monitor: MonitorRow): {
  headers: Record<string, string>;
  body?: string;
} {
  const headers: Record<string, string> = { "user-agent": "LogsyMonitor/1.0" };

  // Пользовательские заголовки (JSON-объект в поле headers).
  if (monitor.headers) {
    try {
      const parsed = JSON.parse(monitor.headers) as Record<string, unknown>;
      for (const [k, v] of Object.entries(parsed)) {
        if (k.trim()) headers[k.trim()] = String(v);
      }
    } catch {
      // некорректный JSON заголовков — пропускаем
    }
  }

  // Тело отправляем только для методов, которые его допускают.
  const methodAllowsBody = !["GET", "HEAD"].includes(monitor.method.toUpperCase());
  if (
    methodAllowsBody &&
    monitor.bodyType !== "NONE" &&
    monitor.body &&
    monitor.body.length > 0
  ) {
    const ct = CONTENT_TYPE[monitor.bodyType];
    const hasContentType = Object.keys(headers).some(
      (h) => h.toLowerCase() === "content-type",
    );
    if (ct && !hasContentType) headers["content-type"] = ct;
    return { headers, body: monitor.body };
  }

  return { headers };
}

/**
 * Возвращает URL для запроса с учётом порта монитора. Если порт не задан,
 * используется стандартный порт схемы (80 для http, 443 для https).
 */
export function effectiveUrl(rawUrl: string, port: number | null): string {
  if (port == null) return rawUrl;
  try {
    const u = new URL(rawUrl);
    u.port = String(port);
    return u.toString();
  } catch {
    return rawUrl;
  }
}

/** Нужно ли проверять монитор прямо сейчас (по его интервалу). */
export function isDue(monitor: {
  interval: string;
  lastCheckedAt: Date | null;
}): boolean {
  if (!monitor.lastCheckedAt) return true;
  const step = INTERVAL_MS[monitor.interval] ?? INTERVAL_MS["1m"];
  // Небольшой допуск (5 c), чтобы 1m-проверки не «уползали» из-за времени выполнения.
  return Date.now() - monitor.lastCheckedAt.getTime() >= step - 5000;
}

interface ProbeResult {
  ok: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
}

const MAX_BODY_CHARS = 500;

// Эскалация повторных оповещений, пока монитор остаётся недоступным.
// Первый алерт уходит сразу при падении, далее — напоминания: чем дольше
// длится авария, тем реже письма (не спамим и не попадаем под rate-limit).
// Для каждого порога простоя (afterMs) задан свой шаг напоминаний (everyMs);
// берётся последний подходящий сверху вниз, последний тир повторяется до
// восстановления. Реальная частота не может быть чаще интервала проверки.
const ESCALATION: Array<{ afterMs: number; everyMs: number }> = [
  { afterMs: 0, everyMs: 15 * 60 * 1000 }, // первый час простоя — каждые 15 мин
  { afterMs: 60 * 60 * 1000, everyMs: 60 * 60 * 1000 }, // после 1 ч — каждый час
  { afterMs: 6 * 60 * 60 * 1000, everyMs: 4 * 60 * 60 * 1000 }, // после 6 ч — каждые 4 ч
];

/** Шаг напоминаний для текущей длительности простоя. */
function reminderStepMs(outageMs: number): number {
  let step = ESCALATION[0].everyMs;
  for (const tier of ESCALATION) {
    if (outageMs >= tier.afterMs) step = tier.everyMs;
  }
  return step;
}

/** Человекочитаемая длительность (ru), минимум «1 мин». */
function formatDuration(ms: number): string {
  const totalMin = Math.max(1, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} мин`;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/** Читает тело ответа и возвращает усечённый однострочный сниппет. */
async function readBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return "";
    return normalized.length > MAX_BODY_CHARS
      ? normalized.slice(0, MAX_BODY_CHARS) + "…"
      : normalized;
  } catch {
    return "";
  }
}

/** Делает один HTTP-запрос к URL монитора и возвращает результат. */
async function probe(monitor: MonitorRow): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), monitor.timeoutMs);
  const start = Date.now();

  try {
    const { headers, body } = buildRequestInit(monitor);
    const res = await fetch(effectiveUrl(monitor.url, monitor.port), {
      method: monitor.method,
      // Идём по редиректам (301/302/307/308), как обычный веб-клиент, и
      // проверяем статус конечной страницы — иначе редирект считался бы ошибкой.
      redirect: "follow",
      signal: controller.signal,
      headers,
      body,
    });
    const responseTimeMs = Date.now() - start;
    const ok = res.status === monitor.expectedStatus;

    let error: string | null = null;
    if (!ok) {
      // Забираем тело ответа сервера (усечённое), чтобы показать реальный
      // текст ошибки, а не только код статуса.
      const body = await readBody(res);
      error =
        `Ожидался статус ${monitor.expectedStatus}, получен ${res.status}` +
        (body ? `. Ответ сервера: ${body}` : "");
    }

    return { ok, statusCode: res.status, responseTimeMs, error };
  } catch (err) {
    const responseTimeMs = Date.now() - start;
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `Таймаут запроса (${monitor.timeoutMs} мс)`
        : err instanceof Error
          ? err.message
          : "Неизвестная ошибка сети";
    return { ok: false, statusCode: null, responseTimeMs, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/** Отправляет алерт на все email-контакты владельца монитора. */
async function notify(
  monitor: MonitorRow,
  kind: "DOWN" | "RECOVERY",
  detail: string,
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: monitor.projectId },
    select: { userId: true, name: true },
  });
  if (!project) return;

  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  if (contacts.length === 0) return;

  const isDown = kind === "DOWN";
  const subject = isDown
    ? `🔴 Монитор «${monitor.name}» недоступен`
    : `🟢 Монитор «${monitor.name}» снова доступен`;
  const text =
    `Проект: ${project.name}\n` +
    `Монитор: ${monitor.name}\n` +
    `URL: ${monitor.method} ${monitor.url}\n` +
    `Статус: ${isDown ? "НЕДОСТУПЕН" : "ВОССТАНОВЛЕН"}\n` +
    `Детали: ${detail}\n` +
    `Время: ${new Date().toLocaleString("ru-RU")}\n`;

  for (const contact of contacts) {
    try {
      if (contact.type === "TELEGRAM") {
        await sendTelegramMessage(contact.value, `${subject}\n\n${text}`);
      } else {
        await sendMail({ to: contact.value, subject, text });
      }
      await prisma.alert.create({
        data: {
          monitorId: monitor.id,
          contactId: contact.id,
          kind,
          message: `${subject} — ${detail}`,
        },
      });
    } catch (err) {
      console.error(`[Logsy] Не удалось отправить алерт на ${contact.value}:`, err);
    }
  }
}

/**
 * DOWN-алерты текущей аварии: первый и последний по времени. «Текущая авария» —
 * все DOWN-алерты, отправленные после последнего RECOVERY (или все, если
 * восстановлений ещё не было). Отсюда берём начало простоя (firstAt) и время
 * последнего напоминания (lastAt).
 */
async function outageDownAlerts(
  monitorId: string,
): Promise<{ firstAt: Date | null; lastAt: Date | null }> {
  const lastRecovery = await prisma.alert.findFirst({
    where: { monitorId, kind: "RECOVERY" },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  // undefined-фильтр Prisma игнорирует — если RECOVERY не было, берём все DOWN.
  const where = {
    monitorId,
    kind: "DOWN",
    sentAt: lastRecovery ? { gt: lastRecovery.sentAt } : undefined,
  };
  const [first, last] = await Promise.all([
    prisma.alert.findFirst({ where, orderBy: { sentAt: "asc" }, select: { sentAt: true } }),
    prisma.alert.findFirst({ where, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
  ]);
  return { firstAt: first?.sentAt ?? null, lastAt: last?.sentAt ?? null };
}

/**
 * Пора ли повторно напомнить, что монитор всё ещё недоступен. Шаг напоминаний
 * растёт вместе с длительностью простоя (см. ESCALATION). Если отправленных
 * DOWN-алертов ещё нет (например, письмо не ушло) — напоминаем снова.
 */
async function shouldRepeatDownAlert(monitorId: string): Promise<boolean> {
  const { firstAt, lastAt } = await outageDownAlerts(monitorId);
  if (!firstAt || !lastAt) return true;
  const now = Date.now();
  const step = reminderStepMs(now - firstAt.getTime());
  return now - lastAt.getTime() >= step;
}

/** Проверяет один монитор: пишет результат, обновляет статус, шлёт алерты при переходах. */
export async function checkMonitor(monitor: MonitorRow): Promise<ProbeResult> {
  const result = await probe(monitor);
  const newStatus = result.ok ? "UP" : "DOWN";

  await prisma.checkResult.create({
    data: {
      monitorId: monitor.id,
      ok: result.ok,
      statusCode: result.statusCode,
      responseTimeMs: result.responseTimeMs,
      error: result.error,
    },
  });

  await prisma.monitor.update({
    where: { id: monitor.id },
    data: { lastStatus: newStatus, lastCheckedAt: new Date() },
  });

  // Первый DOWN-алерт уходит сразу при падении, далее — повторные напоминания
  // с нарастающим шагом (эскалация), пока сервис не восстановится.
  // Восстановление (RECOVERY) оповещается один раз на переходе DOWN → UP и
  // содержит суммарную длительность простоя.
  if (newStatus === "DOWN") {
    const justWentDown = monitor.lastStatus !== "DOWN";
    if (justWentDown || (await shouldRepeatDownAlert(monitor.id))) {
      await notify(monitor, "DOWN", result.error ?? "Проверка не пройдена");
    }
  } else if (newStatus === "UP" && monitor.lastStatus === "DOWN") {
    // Длительность простоя считаем от первого DOWN-алерта текущей аварии.
    const { firstAt } = await outageDownAlerts(monitor.id);
    const detail = firstAt
      ? `Сервис отвечает штатно. Время простоя: ${formatDuration(Date.now() - firstAt.getTime())}`
      : "Сервис отвечает штатно";
    await notify(monitor, "RECOVERY", detail);
  }

  return result;
}

/**
 * Обходит все активные мониторы, у которых подошёл срок проверки, и проверяет их.
 * Возвращает число проверенных мониторов.
 */
export async function runDueChecks(): Promise<number> {
  const monitors = await prisma.monitor.findMany({
    where: { isActive: true },
    include: {
      project: {
        select: { user: { select: { role: true, subscription: true } } },
      },
    },
  });

  const now = new Date();
  // Проверяем только мониторы пользователей с активной подпиской (или идущим
  // пробным периодом). Истёк триал / нет оплаты — мониторинг останавливается.
  const due = monitors.filter(
    (m) =>
      isDue(m) &&
      isServiceActive(
        m.project.user.subscription,
        m.project.user.role === "ADMIN",
        now,
      ),
  );
  await Promise.all(due.map((m) => checkMonitor(m).catch((e) => console.error(e))));

  // Параллельно проверяем сроки SSL-сертификатов проектов (для тех, у кого
  // включена проверка и активна подписка).
  await runDueProjectSslChecks(now).catch((e) =>
    console.error("[Logsy] Ошибка проверки SSL проектов:", e),
  );

  return due.length;
}
