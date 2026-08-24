// Выгрузка журнала согласий проекта в CSV.
//
// Журнал — это и есть доказательство согласия (ч. 1 ст. 9 152-ФЗ): по требованию
// проверяющего или субъекта ПД нужно предъявить факт, время, версии документов и
// технические реквизиты визита. Файл открывается Excel'ем, поэтому разделитель — ";",
// а перед содержимым идёт BOM (иначе кириллица в Excel ломается).
//
// Доступ — только владельцу проекта.

import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  PD: "Персональные данные",
  MARKETING: "Рекламная рассылка",
  COOKIE: "Cookie",
};

/** Экранирование значения для CSV: кавычки удваиваются, поле берётся в кавычки. */
function cell(value: string | null | undefined): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return new Response("Не авторизован", { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: { id: true, domain: true, userId: true },
  });
  if (!project || project.userId !== userId) {
    return new Response("Сайт не найден", { status: 404 });
  }

  // Выгружаем весь журнал: он нужен целиком, а объём — одна строка на согласие.
  const consents = await prisma.consent.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 50000,
  });

  const header = [
    "Дата и время",
    "Вид согласия",
    "Страница",
    "Форма",
    "Текст рядом с галочкой",
    "Версии документов",
    "IP",
    "User-Agent",
    "Ключ сессии",
  ];
  const rows = consents.map((c) =>
    [
      cell(c.createdAt.toISOString()),
      cell(KIND_LABEL[c.kind] ?? c.kind),
      cell(c.page),
      cell(c.formAction),
      cell(c.text),
      cell(c.docs),
      cell(c.ip),
      cell(c.userAgent),
      cell(c.sessionKey),
    ].join(";"),
  );
  const csv = "﻿" + [header.map(cell).join(";"), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="consents-${project.domain}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
