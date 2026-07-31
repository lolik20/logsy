// Общие константы и хелперы доски задач проекта (канбан).
//
// Задача имеет один из трёх статусов и заводится либо вручную из панели, либо
// автоматически при получении сообщения об ошибке из обратной формы (USER_REPORT).

import { prisma } from "@/lib/prisma";

/** Статусы задачи в порядке колонок доски. */
export const TASK_STATUSES = ["CREATED", "IN_PROGRESS", "DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Человекочитаемые подписи статусов (для колонок доски и бейджей). */
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  CREATED: "Создано",
  IN_PROGRESS: "В работе",
  DONE: "Выполнено",
};

/** Проверяет, что строка — допустимый статус задачи. */
export function isTaskStatus(v: unknown): v is TaskStatus {
  return typeof v === "string" && (TASK_STATUSES as readonly string[]).includes(v);
}

/** Сообщение об ошибке из обратной формы для заведения задачи. */
export type ReportTaskInput = {
  message: string | null;
  url: string | null;
  email: string | null;
};

/**
 * Обработанное сообщение обратной формы и задача, к которой оно привязано (taskId = null,
 * если задачу завести не удалось). taskId нужен уведомлениям: ответ владельца из Telegram
 * дописывается в переписку именно этой задачи (см. src/lib/user-report.ts).
 */
export type ReportTaskResult = ReportTaskInput & { taskId: string | null };

/**
 * Заводит задачи в статусе CREATED по сообщениям обратной формы ошибок. Вызывается из
 * ингеста логов: на каждое непустое сообщение USER_REPORT либо создаётся отдельная
 * задача (привязанная к породившей её сессии), либо, если в этой же сессии уже есть
 * незакрытая задача-обращение с той же почтой пользователя, сообщение дописывается в
 * её переписку (TaskMessage, INCOMING). Так продолжение диалога от одного посетителя
 * не плодит новые задачи, а превращается в переписку в рамках существующей задачи.
 * Заголовок новой задачи — первая строка сообщения (усечён), полный текст — в описании.
 * Best-effort: ошибки не должны мешать приёму логов.
 *
 * Возвращает непустые сообщения вместе с id задачи, к которой каждое привязано (новой или
 * продолженной) — по нему уведомление о сообщении умеет принять ответ владельца в переписку.
 *
 * Задачи создаём по одной через prisma.task.create (как ручное создание в /api/tasks),
 * а не пачкой createMany: во-первых, это та же операция, что уже работает при ручном
 * заведении задачи; во-вторых, сбой на одном сообщении не отменяет создание остальных —
 * каждую задачу пишем в своём try/catch и логируем ошибку, а не роняем всю пачку.
 */
export async function createTasksFromReports(
  projectId: string,
  sessionId: string,
  reports: ReportTaskInput[],
): Promise<ReportTaskResult[]> {
  const items = reports.filter((r) => r.message && r.message.trim());
  if (items.length === 0) return [];
  const results: ReportTaskResult[] = [];

  // Новые задачи кладём наверх колонки «Создано»: берём минимальную текущую позицию.
  const top = await prisma.task.aggregate({
    where: { projectId, status: "CREATED" },
    _min: { position: true },
  });
  let position = (top._min.position ?? 0) - 1;

  for (const r of items) {
    const message = r.message!.trim();
    const email = r.email?.trim() || null;

    try {
      // Продолжение диалога: если посетитель уже писал в этой сессии (та же почта) и
      // задача по его обращению ещё не закрыта — дописываем сообщение в её переписку,
      // а не создаём новую задачу. Почта обязательна: без неё диалог не связать.
      if (email) {
        const existing = await prisma.task.findFirst({
          where: {
            projectId,
            sessionId,
            source: "REPORT",
            reporterEmail: email,
            status: { not: "DONE" },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        });
        if (existing) {
          await prisma.taskMessage.create({
            data: {
              taskId: existing.id,
              direction: "INCOMING",
              body: message,
              fromEmail: email,
            },
          });
          results.push({ ...r, taskId: existing.id });
          continue;
        }
      }

      const firstLine = message.split("\n")[0]!.trim();
      const title = firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine;
      const task = await prisma.task.create({
        data: {
          projectId,
          title: title || "Сообщение об ошибке",
          description: message,
          status: "CREATED",
          source: "REPORT",
          reporterEmail: email,
          sessionId,
          position: position--,
        },
        select: { id: true },
      });
      results.push({ ...r, taskId: task.id });
    } catch (err) {
      console.error(
        "[Logsy] Не удалось завести задачу из сообщения пользователя:",
        err,
      );
      // Сообщение всё равно возвращаем: уведомление о нём должно уйти и без задачи.
      results.push({ ...r, taskId: null });
    }
  }

  return results;
}
