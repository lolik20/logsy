import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { trialEndFrom } from "@/lib/subscription";

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

  const domain = parsed.data.domain.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");

  // Домен уникален глобально: по нему сервис логирования определяет проект по Origin.
  // Если такой домен уже заведён (в любом аккаунте) — создать нельзя.
  const taken = await prisma.project.findFirst({
    where: { domain: { equals: domain, mode: "insensitive" } },
    select: { id: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: "Этот домен уже используется в другом проекте." },
      { status: 409 },
    );
  }

  // Новый проект получает собственный пробный период (тарификация — за проект).
  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name: parsed.data.name.trim(),
        domain,
        billingStatus: "TRIAL",
        trialEndsAt: trialEndFrom(),
      },
    });
    return NextResponse.json({ project });
  } catch (e) {
    // Гонка по уникальному домену.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Этот домен уже используется в другом проекте." },
        { status: 409 },
      );
    }
    throw e;
  }
}
