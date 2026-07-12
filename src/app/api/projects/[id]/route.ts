import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const patchSchema = z.object({
  checkSsl: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  // При включении проверки сбрасываем OFF в PENDING, чтобы ближайший прогон
  // сразу проверил сертификат.
  const data: {
    checkSsl?: boolean;
    sslStatus?: string;
    sslCheckedAt?: null;
    sslAlertHours?: null;
  } = {};
  if (parsed.data.checkSsl !== undefined) {
    data.checkSsl = parsed.data.checkSsl;
    if (parsed.data.checkSsl) {
      data.sslStatus = "PENDING";
      data.sslCheckedAt = null;
      data.sslAlertHours = null;
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json({ project: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
