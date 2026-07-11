import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

async function ownedMonitor(userId: string, id: string) {
  const monitor = await prisma.monitor.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!monitor || monitor.project.userId !== userId) return null;
  return monitor;
}

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
  interval: z.enum(["1m", "1h", "1d"]).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const monitor = await ownedMonitor(userId, params.id);
  if (!monitor) return NextResponse.json({ error: "Монитор не найден" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
  }

  const updated = await prisma.monitor.update({
    where: { id: params.id },
    data: parsed.data,
  });
  return NextResponse.json({ monitor: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const monitor = await ownedMonitor(userId, params.id);
  if (!monitor) return NextResponse.json({ error: "Монитор не найден" }, { status: 404 });

  await prisma.monitor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
