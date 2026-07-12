import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createPasswordResetToken,
  buildPasswordResetUrl,
} from "@/lib/password-reset";
import { sendMail } from "@/lib/mailer";

const schema = z.object({
  email: z.string().email("Некорректный email"),
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

  const email = parsed.data.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Письмо со ссылкой отправляем только реальному пользователю, но клиенту
  // всегда возвращаем ok — чтобы не раскрывать, какие email зарегистрированы.
  if (user) {
    const appUrl = process.env.APP_URL || "http://localhost:3000";
    const token = await createPasswordResetToken(email);
    const resetUrl = buildPasswordResetUrl(appUrl, token);

    await sendMail({
      to: email,
      subject: "Сброс пароля в Logsy",
      text:
        `Здравствуйте!\n\n` +
        `Мы получили запрос на сброс пароля для вашего аккаунта в Logsy.\n\n` +
        `Чтобы задать новый пароль, перейдите по ссылке (действует 1 час):\n` +
        `  ${resetUrl}\n\n` +
        `Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо, ` +
        `ваш текущий пароль останется без изменений.\n\n` +
        `— Команда Logsy`,
    });
  }

  return NextResponse.json({ ok: true });
}
