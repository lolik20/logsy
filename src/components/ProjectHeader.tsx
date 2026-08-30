import Link from "next/link";
import { ProjectServiceTabs, type ProjectServiceKey } from "@/components/ProjectServiceTabs";

// Общая шапка страниц сервисов проекта: назад к проектам, название/домен и вкладки.
export function ProjectHeader({
  projectId,
  name,
  domain,
  active,
}: {
  projectId: string;
  name: string;
  domain: string;
  active: ProjectServiceKey;
}) {
  return (
    <div className="mb-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
        ← К сайтам
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">{name}</h1>
        {/* Имя проекта по умолчанию равно домену (см. api/projects) — тогда
            строка с доменом дублировала бы заголовок, и мы её не показываем. */}
        {domain.trim().toLowerCase() !== name.trim().toLowerCase() && (
          <p className="text-sm text-slate-500">{domain}</p>
        )}
      </div>
      <ProjectServiceTabs projectId={projectId} active={active} />
    </div>
  );
}
