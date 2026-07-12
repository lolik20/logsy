import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

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
    where: { userId: project.userId, type: "EMAIL" },
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
      await sendMail({ to: contact.value, subject, text });
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

  // Алерт только на смене состояния (не спамим, пока статус держится).
  if (newStatus === "DOWN" && monitor.lastStatus !== "DOWN") {
    await notify(monitor, "DOWN", result.error ?? "Проверка не пройдена");
  } else if (newStatus === "UP" && monitor.lastStatus === "DOWN") {
    await notify(monitor, "RECOVERY", "Сервис отвечает штатно");
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
  });

  const due = monitors.filter((m) => isDue(m));
  await Promise.all(due.map((m) => checkMonitor(m).catch((e) => console.error(e))));
  return due.length;
}
