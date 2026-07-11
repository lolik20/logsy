import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const schema = z.object({
  name: z.string().min(1, "Укажите название").max(120),
  domain: z.string().min(1, "Укажите домен").max(255),
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

  // Проверка лимита тарифа: количество сайтов не больше sitesLimit.
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  const limit = sub?.sitesLimit ?? 1;
  const count = await prisma.project.count({ where: { userId } });
  if (count >= limit) {
    return NextResponse.json(
      {
        error: `Достигнут лимит тарифа (${limit} сайт(ов)). Оформите подписку в разделе «Тарифы».`,
      },
      { status: 402 },
    );
  }

  const domain = parsed.data.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  const project = await prisma.project.create({
    data: { userId, name: parsed.data.name.trim(), domain },
  });

  return NextResponse.json({ project });
}
