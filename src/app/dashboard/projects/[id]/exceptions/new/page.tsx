import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ExceptionCreateForm } from "@/components/ExceptionCreateForm";
import type { ExceptionKind } from "@/lib/exceptions";

export const dynamic = "force-dynamic";

export default async function NewExceptionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { kind?: string; url?: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });

  // Правила-исключения задаёт владелец проекта (или администратор).
  if (!project || (project.userId !== userId && !admin)) notFound();

  // Категория приходит из карточки события; по умолчанию — ошибка.
  const defaultKind: ExceptionKind =
    searchParams.kind === "SLOW_REQUEST" ? "SLOW_REQUEST" : "ERROR";
  const defaultUrl = searchParams.url ?? "";

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/projects/${project.id}/logging`}
          className="text-sm text-slate-500 hover:text-brand"
        >
          ← К логам «{project.name}»
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Добавить в исключения</h1>
      </div>

      <ExceptionCreateForm
        projectId={project.id}
        defaultKind={defaultKind}
        defaultUrl={defaultUrl}
      />
    </div>
  );
}
