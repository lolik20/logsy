import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { SessionReplay } from "@/components/SessionReplay";

export const dynamic = "force-dynamic";

/**
 * Выделенная страница воспроизведения записи экрана сессии (rrweb).
 *
 * Плеер вынесен на отдельную полноэкранную страницу специально: rrweb-player при
 * монтировании считает масштаб от размеров контейнера, и во встроенном/скрытом блоке это
 * давало «белый экран». Здесь контейнер всегда виден и во всю ширину, поэтому запись
 * строится и масштабируется корректно. Загрузка стартует автоматически (autoLoad).
 */
export default async function SessionReplayPage({
  params,
}: {
  params: { id: string; sessionId: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const session = await prisma.logSession.findUnique({
    where: { id: params.sessionId },
    select: {
      id: true,
      sessionKey: true,
      projectId: true,
      startedAt: true,
      project: { select: { id: true, name: true, userId: true } },
    },
  });

  if (
    !session ||
    session.projectId !== params.id ||
    (session.project.userId !== userId && !admin)
  ) {
    notFound();
  }

  return (
    <div>
      <Link
        href={`/dashboard/projects/${session.project.id}/logging/${session.id}`}
        className="text-sm text-slate-500 hover:text-brand"
      >
        ← К сессии
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Запись экрана</h1>
      <p className="text-sm text-slate-500">
        Сессия <span className="font-mono">{session.sessionKey.slice(0, 8)}</span> ·{" "}
        {new Date(session.startedAt).toLocaleString("ru-RU")}
      </p>

      <SessionReplay sessionId={session.id} autoLoad className="mt-6" />
    </div>
  );
}
