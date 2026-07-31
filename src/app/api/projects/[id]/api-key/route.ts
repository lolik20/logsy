import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { regenerateProjectApiKey } from "@/lib/api-key";

// Перевыпуск ключа публичного API проекта (кнопка на вкладке «API»).
// Старый ключ сразу перестаёт работать — интеграции нужно перевести на новый.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const admin = await isAdmin();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  });
  if (!project || (project.userId !== userId && !admin)) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  const apiKey = await regenerateProjectApiKey(project.id);
  return NextResponse.json({ apiKey });
}
