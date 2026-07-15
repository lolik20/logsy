// Повторная отправка письма подтверждения для email-контакта (по кнопке в панели).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { sendContactVerification } from "@/lib/contact-verification";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const contact = await prisma.contact.findUnique({ where: { id: params.id } });
  if (!contact || contact.userId !== userId) {
    return NextResponse.json({ error: "Контакт не найден" }, { status: 404 });
  }
  if (contact.type !== "EMAIL") {
    return NextResponse.json({ error: "Подтверждение нужно только для email" }, { status: 400 });
  }
  if (contact.verified) {
    return NextResponse.json({ error: "Email уже подтверждён" }, { status: 400 });
  }

  await sendContactVerification(contact);
  return NextResponse.json({ ok: true });
}
