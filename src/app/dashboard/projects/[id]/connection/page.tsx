import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { FeedbackFormSettings } from "@/components/FeedbackFormSettings";
import { RecordSessionSettings } from "@/components/RecordSessionSettings";
import { CookieBannerSettings } from "@/components/CookieBannerSettings";
import { VpnNoticeSettings } from "@/components/VpnNoticeSettings";
import { SlowThresholdSettings } from "@/components/SlowThresholdSettings";
import { SdkStatusCard } from "@/components/SdkStatusCard";
import { CopyCodeBlock } from "@/components/CopyCodeBlock";
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

  // Вставка тега на WordPress без плагина — хук wp_head в functions.php темы.
  const wpSnippet = `add_action('wp_head', function () {
  echo '${snippet}';
});`;

  // Готовый промпт для ИИ-ассистента (Claude Code, Cursor, ChatGPT и т.п.):
  // пользователь копирует его целиком, ассистент сам вставляет тег в код сайта.
  const aiPrompt = `Подключи к моему сайту ${project.domain} скрипт мониторинга Logsy.

Добавь в <head> каждой страницы сайта один тег:
${snippet}

Требования:
- тег должен быть на всех страницах (общий layout, шаблон или header);
- если тег уже есть, второй раз не добавляй;
- ключ не нужен — события принимаются только с домена ${project.domain};
- если сайт на WordPress, добавь тег через хук wp_head в functions.php темы или через плагин вставки кода в header;
- в конце напиши, какие файлы ты изменил.`;

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

      {/* Сайт на WordPress — два способа вставить тот же тег. */}
      <details className="group mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex cursor-pointer items-center gap-2 px-5 py-4">
          <span className="flex-1 text-base font-semibold text-slate-800 dark:text-slate-100">
            Подключение на WordPress
          </span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            Способ 1 — плагином (проще)
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-500">
            <li>
              Установите плагин для вставки кода в шапку — например{" "}
              <span className="font-medium">WPCode</span> (бывший Insert Headers
              and Footers): Плагины → Добавить новый.
            </li>
            <li>
              Откройте Code Snippets → Header &amp; Footer и вставьте тег в поле{" "}
              <span className="font-medium">Header</span>:
            </li>
          </ol>
          <div className="mt-2">
            <CopyCodeBlock code={snippet} />
          </div>

          <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-200">
            Способ 2 — кодом в теме
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Добавьте в файл <code className="font-mono">functions.php</code>{" "}
            вашей темы (Внешний вид → Редактор файлов темы):
          </p>
          <div className="mt-2">
            <CopyCodeBlock code={wpSnippet} />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            После установки откройте сайт в браузере и обновите статус
            подключения в карточке выше.
          </p>
        </div>
      </details>

      {/* Подключение руками нейросети: готовый промпт для ИИ-ассистента. */}
      <details className="group mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <summary className="flex cursor-pointer items-center gap-2 px-5 py-4">
          <span className="flex-1 text-base font-semibold text-slate-800 dark:text-slate-100">
            Подключение с помощью нейросети
          </span>
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </summary>
        <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-sm text-slate-500">
            Если сайтом занимается ИИ-ассистент (Claude Code, Cursor, ChatGPT и
            т.п.), скопируйте промпт целиком и отправьте ему — ассистент сам
            вставит тег в код сайта.
          </p>
          <div className="mt-3">
            <CopyCodeBlock code={aiPrompt} />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            После выката изменений откройте сайт и обновите статус подключения в
            карточке выше.
          </p>
        </div>
      </details>

      <SlowThresholdSettings projectId={project.id} slowMs={project.slowMs} />

      <FeedbackFormSettings projectId={project.id} enabled={project.feedbackEnabled} />

      <RecordSessionSettings projectId={project.id} enabled={project.recordSession} />

      <CookieBannerSettings projectId={project.id} enabled={project.cookieBanner} />

      <VpnNoticeSettings projectId={project.id} enabled={project.vpnNotice} />
    </div>
  );
}
