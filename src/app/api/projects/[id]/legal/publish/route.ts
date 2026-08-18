// Публикация правовых документов проекта: рендерит политику, оферту и текст согласия
// из текущих реквизитов оператора и сохраняет их новыми версиями (снимком текста).
// Ссылки на документы постоянные — меняется только содержимое последней версии.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { LEGAL_DOC_TITLES, LEGAL_DOC_TYPES, legalDocUrl, publishLegalDocs } from "@/lib/legal";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true, legal: { select: { publicSlug: true } } },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }
  if (!project.legal) {
    return NextResponse.json(
      { error: "Сначала заполните реквизиты оператора на вкладке «Документы»" },
      { status: 400 },
    );
  }

  try {
    const versions = await publishLegalDocs(project.id);
    return NextResponse.json({
      docs: LEGAL_DOC_TYPES.map((type) => ({
        type,
        title: LEGAL_DOC_TITLES[type],
        version: versions[type],
        url: legalDocUrl(project.legal!.publicSlug, type),
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Не удалось опубликовать документы";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
