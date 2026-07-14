import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { MonitorCreateForm } from "@/components/MonitorCreateForm";

export const dynamic = "force-dynamic";

export default async function NewMonitorPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });

  // Добавлять мониторы может только владелец проекта.
  if (!project || project.userId !== userId) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/projects/${project.id}`}
          className="text-sm text-slate-500 hover:text-brand"
        >
          ← К проекту «{project.name}»
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Новый монитор</h1>
        <p className="text-sm text-slate-500">{project.domain}</p>
      </div>

      <MonitorCreateForm projectId={project.id} projectDomain={project.domain} />
    </div>
  );
}
