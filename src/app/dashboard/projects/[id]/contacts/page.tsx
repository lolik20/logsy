import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { getBotLink } from "@/lib/telegram";
import { ContactManager } from "@/components/ContactManager";
import { ProjectHeader } from "@/components/ProjectHeader";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  DOWN: "Падение",
  RECOVERY: "Восстановление",
  SSL: "SSL",
  DOMAIN: "Домен",
  SUBSCRIPTION: "Тариф",
};

export default async function ProjectContactsPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const isowner = project.userId === userId;

  const [alerts, contacts, botLink] = await Promise.all([
    prisma.alert.findMany({
      where: { monitor: { projectId: project.id } },
      orderBy: { sentAt: "desc" },
      take: 50,
      include: { monitor: { select: { name: true } } },
    }),
    isowner
      ? prisma.contact.findMany({ where: { userId }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
    getBotLink(),
  ]);

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="contacts"
      />

      {isowner && (
        <>
          <p className="mb-4 text-sm text-slate-500">
            Каналы уведомлений общие для аккаунта — приходят, когда мониторы
            проекта падают или восстанавливаются, а также при истечении SSL,
            регистрации домена и тарифа.
          </p>
          <ContactManager
            botLink={botLink}
            contacts={contacts.map((c) => ({
              id: c.id,
              type: c.type,
              value: c.value,
              verified: c.verified,
            }))}
          />
        </>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">История оповещений</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Время</th>
              <th className="px-4 py-2 font-medium">Монитор</th>
              <th className="px-4 py-2 font-medium">Тип</th>
              <th className="px-4 py-2 font-medium">Сообщение</th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Оповещений по проекту ещё не было.
                </td>
              </tr>
            )}
            {alerts.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">
                  {new Date(a.sentAt).toLocaleString("ru-RU")}
                </td>
                <td className="px-4 py-2">{a.monitor.name}</td>
                <td className="px-4 py-2">{KIND_LABEL[a.kind] ?? a.kind}</td>
                <td className="px-4 py-2 text-slate-500">{a.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
