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
 * Заводит задачи в статусе CREATED по сообщениям обратной формы ошибок. Вызывается из
 * ингеста логов: на каждое непустое сообщение USER_REPORT создаётся отдельная задача,
 * привязанная к породившей её сессии. Заголовок — первая строка сообщения (усечён),
 * полный текст — в описании. Best-effort: ошибки не должны мешать приёму логов.
 */
export async function createTasksFromReports(
  projectId: string,
  sessionId: string,
  reports: ReportTaskInput[],
): Promise<void> {
  const items = reports.filter((r) => r.message && r.message.trim());
  if (items.length === 0) return;

  // Новые задачи кладём наверх колонки «Создано»: берём минимальную текущую позицию.
  const top = await prisma.task.aggregate({
    where: { projectId, status: "CREATED" },
    _min: { position: true },
  });
  let position = (top._min.position ?? 0) - 1;

  const data = items.map((r) => {
    const message = r.message!.trim();
    const firstLine = message.split("\n")[0]!.trim();
    const title = firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine;
    return {
      projectId,
      title: title || "Сообщение об ошибке",
      description: message,
      status: "CREATED",
      source: "REPORT",
      reporterEmail: r.email?.trim() || null,
      sessionId,
      position: position--,
    };
  });

  await prisma.task.createMany({ data });
}
