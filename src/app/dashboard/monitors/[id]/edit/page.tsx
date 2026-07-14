import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { MonitorEditForm } from "@/components/MonitorEditForm";

export const dynamic = "force-dynamic";

export default async function EditMonitorPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const monitor = await prisma.monitor.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  // Редактировать монитор может только его владелец.
  if (!monitor || monitor.project.userId !== userId) notFound();

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/dashboard/monitors/${monitor.id}`}
          className="text-sm text-slate-500 hover:text-brand"
        >
          ← К монитору «{monitor.name}»
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Редактирование монитора</h1>
      </div>

      <MonitorEditForm
        id={monitor.id}
        name={monitor.name}
        url={monitor.url}
        port={monitor.port}
        method={monitor.method}
        interval={monitor.interval}
        expectedStatus={monitor.expectedStatus}
        timeoutMs={monitor.timeoutMs}
        headers={monitor.headers}
        bodyType={monitor.bodyType}
        body={monitor.body}
      />
    </div>
  );
}
