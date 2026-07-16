// Проверка подключения SDK логирования на сайте проекта по запросу владельца (или
// администратора). Делает запрос на домен проекта и ищет тег <script> нашего SDK в <head>
// главной страницы (см. src/lib/sdk-check.ts). Результат панель показывает во вкладках
// «Логирование» и «Подключение».

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { checkSdkInstalled } from "@/lib/sdk-check";

export const dynamic = "force-dynamic";
// Запрос к внешнему сайту может занять несколько секунд — поднимаем лимит выполнения.
export const maxDuration = 30;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, domain: true },
  });
  if (!project || (project.userId !== userId && !admin)) {
    return NextResponse.json({ error: "Проект не найден" }, { status: 404 });
  }

  const result = await checkSdkInstalled(project.domain);
  return NextResponse.json(result);
}
