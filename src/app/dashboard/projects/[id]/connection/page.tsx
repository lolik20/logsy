import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { FeedbackFormSettings } from "@/components/FeedbackFormSettings";
import { RecordSessionSettings } from "@/components/RecordSessionSettings";
import { SlowThresholdSettings } from "@/components/SlowThresholdSettings";
import { SdkStatusCard } from "@/components/SdkStatusCard";
import { retentionLabel } from "@/lib/logging";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

// Вкладка «Подключение» — инструкция по установке SDK логирования на сайт проекта.
// Вынесена из вкладки «Логирование» в отдельный пункт меню.
export default async function ConnectionPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const snippet = `<script src="${appUrl()}/api/logger/sdk" async></script>`;

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="connection"
      />

      {/* Статус подключения SDK: запрос на сайт проекта и поиск тега скрипта в <head>. */}
      <SdkStatusCard projectId={project.id} />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Подключение SDK
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Вставьте один тег в <code className="font-mono">&lt;head&gt;</code> сайта{" "}
          <span className="font-mono">{project.domain}</span> — скрипт заработает
          автоматически. Ключ не нужен: события принимаются только с этого домена.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-800">
          {snippet}
        </pre>
        <p className="mt-2 text-xs text-slate-400">
          Скрипт ловит JS-ошибки, упавшие и медленные (&gt;1000 мс) запросы,
          собирает карту загрузки страниц (время до прогрузки контента и медленные
          статические файлы), группирует всё в сессии и отправляет батчами раз в 10
          секунд. Порог «медленного» запроса настраивается ниже. Логи хранятся{" "}
          {retentionLabel(project)}.
        </p>
      </div>

      <SlowThresholdSettings projectId={project.id} slowMs={project.slowMs} />

      <FeedbackFormSettings projectId={project.id} enabled={project.feedbackEnabled} />

      <RecordSessionSettings projectId={project.id} enabled={project.recordSession} />
    </div>
  );
}
