import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { statusSignature } from "@/lib/status";

// Лёгкий эндпоинт для живого обновления панели: возвращает текущие статусы
// мониторов пользователя и их «подпись». Клиент опрашивает его периодически
// и, если подпись изменилась, мягко обновляет страницу без перезагрузки.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await getUserId();
  if (!userId)
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const monitorId = searchParams.get("monitorId");
  const scope = searchParams.get("scope");

  // Админская панель мониторинга (scope=all) следит за мониторами всех
  // пользователей; для обычного пользователя область ограничена его проектами.
  const admin = scope === "all" && (await isAdmin());

  const monitors = await prisma.monitor.findMany({
    where: {
      ...(admin ? {} : { project: { userId } }),
      ...(projectId ? { projectId } : {}),
      ...(monitorId ? { id: monitorId } : {}),
    },
    select: { id: true, lastStatus: true, lastCheckedAt: true },
  });

  return NextResponse.json({
    signature: statusSignature(monitors),
    monitors,
  });
}
