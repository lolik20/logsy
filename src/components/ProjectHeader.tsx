import Link from "next/link";
import { ProjectServiceTabs } from "@/components/ProjectServiceTabs";

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
  active: "monitoring" | "logging" | "alerts" | "tariff";
}) {
  return (
    <div className="mb-6">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
        ← К проектам
      </Link>
      <div className="mt-2">
        <h1 className="text-2xl font-bold">{name}</h1>
        <p className="text-sm text-slate-500">{domain}</p>
      </div>
      <ProjectServiceTabs projectId={projectId} active={active} />
    </div>
  );
}
