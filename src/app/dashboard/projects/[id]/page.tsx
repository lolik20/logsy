import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { StatusBadge } from "@/components/StatusBadge";
import { MonitorManager } from "@/components/MonitorManager";
import { ProjectSslSettings } from "@/components/ProjectSslSettings";
import { ProjectDomainSettings } from "@/components/ProjectDomainSettings";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { StatusAutoRefresh } from "@/components/StatusAutoRefresh";
import { ProjectServiceTabs } from "@/components/ProjectServiceTabs";
import { statusSignature } from "@/lib/status";

export const dynamic = "force-dynamic";

const intervalLabel: Record<string, string> = {
  "1m": "каждую минуту",
  "1h": "каждый час",
  "1d": "каждый день",
};

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      monitors: {
        orderBy: { createdAt: "desc" },
        include: {
          // Последняя проверка — чтобы показать текст ошибки от сервера.
          results: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  // Владелец видит свой проект; администратор — любой.
  if (!project || (project.userId !== userId && !admin)) notFound();

  // Управление проектом (добавление мониторов, удаление) доступно только владельцу.
  const isowner = project.userId === userId;
  const signature = statusSignature(project.monitors);

  // Подключён ли хоть один канал уведомлений: подтверждённая почта или Telegram.
  // Именно такие контакты реально получают оповещения (см. checker/ssl-checker и др.).
  const usableContacts = isowner
    ? await prisma.contact.count({
        where: { userId, OR: [{ verified: true }, { type: { not: "EMAIL" } }] },
      })
    : 1;
  const hasContacts = usableContacts > 0;

  return (
    <div>
      <StatusAutoRefresh
        initialSignature={signature}
        projectId={project.id}
        scope={admin ? "all" : undefined}
      />
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand">
          ← К сайтам
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-slate-500">{project.domain}</p>
          </div>
          {isowner && <DeleteProjectButton projectId={project.id} />}
        </div>
        <ProjectServiceTabs projectId={project.id} active="monitoring" />
      </div>

      {isowner && !hasContacts && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          У сайта не подключены контакты — оповещения о падении, SSL, домене и
          тарифе отправлять некуда. Добавьте канал уведомлений во вкладке{" "}
          <Link
            href={`/dashboard/projects/${project.id}/contacts`}
            className="font-semibold underline underline-offset-2"
          >
            «Контакты»
          </Link>
          .
        </div>
      )}

      {isowner ? (
        <>
          <div className="mb-6">
            <ProjectSslSettings
              projectId={project.id}
              domain={project.domain}
              checkSsl={project.checkSsl}
              sslStatus={project.sslStatus}
              sslExpiresAt={
                project.sslExpiresAt ? project.sslExpiresAt.toISOString() : null
              }
              sslDaysLeft={project.sslDaysLeft}
              sslIssuer={project.sslIssuer}
              sslCheckedAt={
                project.sslCheckedAt ? project.sslCheckedAt.toISOString() : null
              }
            />
          </div>

          <div className="mb-6">
            <ProjectDomainSettings
              projectId={project.id}
              domain={project.domain}
              checkDomain={project.checkDomain}
              domainStatus={project.domainStatus}
              domainExpiresAt={
                project.domainExpiresAt
                  ? project.domainExpiresAt.toISOString()
                  : null
              }
              domainDaysLeft={project.domainDaysLeft}
              domainRegistrar={project.domainRegistrar}
              domainCheckedAt={
                project.domainCheckedAt
                  ? project.domainCheckedAt.toISOString()
                  : null
              }
            />
          </div>

          <MonitorManager projectId={project.id} projectDomain={project.domain} />
        </>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Просмотр сайта пользователя в режиме администратора.
        </div>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Мониторы</h2>
      <div className="grid gap-3">
        {project.monitors.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
            Пока нет мониторов. Добавьте монитор: путь, метод и периодичность
            проверки.
          </p>
        )}
        {project.monitors.map((m) => {
          const lastError = m.results[0]?.error ?? null;
          return (
            <Link
              key={m.id}
              href={`/dashboard/monitors/${m.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-brand dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <StatusBadge status={m.lastStatus} />
                  </div>
                  <div className="mt-1 truncate text-sm text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-800">
                      {m.method}
                    </span>{" "}
                    {m.url}
                  </div>
                </div>
                <div className="ml-3 shrink-0 text-right text-xs text-slate-400">
                  {intervalLabel[m.interval]}
                  {m.lastCheckedAt && (
                    <div>
                      {new Date(m.lastCheckedAt).toLocaleString("ru-RU", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </div>
                  )}
                </div>
              </div>
              {m.lastStatus === "DOWN" && lastError && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  <span className="font-medium">Ошибка:</span> {lastError}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
