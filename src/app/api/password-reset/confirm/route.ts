import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { consumePasswordResetToken } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().min(1, "Отсутствует токен"),
  password: z
    .string()
    .min(8, "Пароль должен быть не короче 8 символов")
    .max(128, "Слишком длинный пароль"),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const email = await consumePasswordResetToken(parsed.data.token);
  if (!email) {
    return NextResponse.json(
      { error: "Ссылка недействительна или устарела. Запросите сброс заново." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Пользователь не найден" },
      { status: 404 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return NextResponse.json({ ok: true });
}
