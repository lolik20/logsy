import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const schema = z.object({
  value: z.string().email("Некорректный email"),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const value = parsed.data.value.trim().toLowerCase();
  const existing = await prisma.contact.findFirst({
    where: { userId, value, type: "EMAIL" },
  });
  if (existing) {
    return NextResponse.json({ error: "Такой контакт уже добавлен" }, { status: 409 });
  }

  const contact = await prisma.contact.create({
    data: { userId, type: "EMAIL", value, verified: true },
  });
  return NextResponse.json({ contact });
}
