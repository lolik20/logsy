import Link from "next/link";
import { getUserId } from "@/lib/session";
import { ProjectCreateForm } from "@/components/ProjectCreateForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  // Доступ только авторизованным — как и остальной раздел дашборда.
  await getUserId();

  return (
    <div>
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
          ← К проектам
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Новый проект</h1>
        <p className="text-sm text-slate-500">
          Укажите название и домен сайта. Новый проект получает пробный период.
        </p>
      </div>

      <ProjectCreateForm />
    </div>
  );
}
