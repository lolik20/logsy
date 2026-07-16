import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const schema = z.object({
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

  // Новый проект стартует на бесплатном тарифе (300 сессий/сутки, хранение 12 часов).
  // Платный тариф выбирается позже во вкладке «Тариф».
  // Вместе с проектом сразу заводим монитор главной страницы (GET https://<домен>/),
  // чтобы у пользователя из коробки была рабочая проверка доступности сайта.
  try {
    const project = await prisma.project.create({
      data: {
        userId,
        // Отдельное название больше не спрашиваем — используем домен как имя проекта.
        name: domain,
        domain,
        billingStatus: "FREE",
        monitors: {
          create: {
            name: "Главная страница",
            url: `https://${domain}/`,
            method: "GET",
          },
        },
      },
    });
    return NextResponse.json({ project });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // Гонка по уникальному домену.
      if (e.code === "P2002") {
        return NextResponse.json(
          { error: "Этот домен уже используется в другом проекте." },
          { status: 409 },
        );
      }
      // FK на userId: пользователя из сессии нет в БД (например, база была
      // пересоздана, а cookie-сессия осталась от старого аккаунта).
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Аккаунт не найден. Выйдите и войдите заново." },
          { status: 401 },
        );
      }
    }
    // Любая другая непредвиденная ошибка — отдаём текст в JSON, чтобы панель его показала.
    console.error("POST /api/projects failed:", e);
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.json(
      { error: `Не удалось создать проект: ${message}` },
      { status: 500 },
    );
  }
}
