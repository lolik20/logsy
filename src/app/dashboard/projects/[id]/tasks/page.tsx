import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { TaskBoard, type BoardTask } from "@/components/TaskBoard";

export const dynamic = "force-dynamic";

// Вкладка «Задачи» — доска со статусами (создано / в работе / выполнено). Задачи
// создаются вручную или автоматически из обратной формы ошибок (событие USER_REPORT).
export default async function TasksPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { messages: true } } },
  });

  const boardTasks: BoardTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    source: t.source,
    reporterEmail: t.reporterEmail,
    sessionId: t.sessionId,
    position: t.position,
    createdAt: t.createdAt.toISOString(),
    messageCount: t._count.messages,
  }));

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="tasks"
      />

      <div className="mb-4">
        <h2 className="text-lg font-semibold">Задачи</h2>
        <p className="mt-1 text-sm text-slate-500">
          Создавайте задачи вручную и перетаскивайте их между колонками. Сообщения из
          обратной формы ошибок попадают сюда автоматически в статусе «Создано».
        </p>
      </div>

      <TaskBoard projectId={project.id} tasks={boardTasks} />
    </div>
  );
}
