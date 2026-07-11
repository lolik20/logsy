import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const contact = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!contact || contact.userId !== userId) {
    return NextResponse.json({ error: "Контакт не найден" }, { status: 404 });
  }

  await prisma.contact.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
