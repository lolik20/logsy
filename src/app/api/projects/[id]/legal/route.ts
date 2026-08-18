// Реквизиты оператора и состав обработки персональных данных для проекта: из этих
// данных генерируются политика, оферта и текст согласия (см. src/lib/legal.ts), а SDK
// подставляет на сайт галочку со ссылками на них.
//
// GET  — текущие данные, опубликованные версии документов и публичные адреса.
// PUT  — сохранить данные (создаёт запись и публичный слаг при первом сохранении).
//
// Доступ — только владельцу проекта.

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import {
  LEGAL_DOC_TYPES,
  LEGAL_DOC_TITLES,
  consentCheckboxText,
  currentDocVersions,
  generateLegalSlug,
  legalDataFrom,
  legalDocUrl,
} from "@/lib/legal";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  operatorType: z.enum(["COMPANY", "IP", "PERSON"]),
  operatorName: z.string().min(2, "Укажите наименование оператора").max(300),
  inn: z.string().regex(/^\d{10}$|^\d{12}$/, "ИНН — 10 цифр у организации, 12 у ИП").nullish(),
  ogrn: z.string().regex(/^\d{13}$|^\d{15}$/, "ОГРН — 13 цифр, ОГРНИП — 15").nullish(),
  address: z.string().max(500).nullish(),
  email: z.string().email("Укажите почту для обращений"),
  phone: z.string().max(50).nullish(),
  siteUrl: z.string().url("Некорректный адрес сайта").nullish(),
  collectsName: z.boolean(),
  collectsEmail: z.boolean(),
  collectsPhone: z.boolean(),
  collectsAddress: z.boolean(),
  collectsPayment: z.boolean(),
  collectsCookies: z.boolean(),
  purposes: z.array(z.string().min(3).max(200)).max(15),
  thirdParties: z.array(z.string().min(2).max(200)).max(15),
  usesMetrika: z.boolean(),
  usesGa: z.boolean(),
  usesMailing: z.boolean(),
  rknNotifiedAt: z.string().datetime().nullish(),
  consentMode: z.enum(["STRICT", "SOFT"]),
  consentText: z.string().max(500).nullish(),
});

/** Проект пользователя либо null, если чужой или не найден. */
async function ownedProject(projectId: string, userId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, domain: true, userId: true, consentEnabled: true, legal: true },
  });
  if (!project || project.userId !== userId) return null;
  return project;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await ownedProject(params.id, userId);
  if (!project) return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });

  const versions = project.legal ? await currentDocVersions(project.id) : {};
  const docs = project.legal
    ? LEGAL_DOC_TYPES.map((type) => ({
        type,
        title: LEGAL_DOC_TITLES[type],
        version: versions[type] ?? null,
        url: legalDocUrl(project.legal!.publicSlug, type),
      }))
    : [];

  return NextResponse.json({
    legal: project.legal,
    consentEnabled: project.consentEnabled,
    docs,
    // Текст рядом с галочкой: свой из настроек либо шаблонный.
    consentText: project.legal
      ? project.legal.consentText ||
        consentCheckboxText(legalDataFrom(project.legal, project.domain))
      : null,
  });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const project = await ownedProject(params.id, userId);
  if (!project) return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const data = {
    operatorType: d.operatorType,
    operatorName: d.operatorName.trim(),
    inn: d.inn ?? null,
    ogrn: d.ogrn ?? null,
    address: d.address?.trim() || null,
    email: d.email.trim(),
    phone: d.phone?.trim() || null,
    siteUrl: d.siteUrl || `https://${project.domain}`,
    collectsName: d.collectsName,
    collectsEmail: d.collectsEmail,
    collectsPhone: d.collectsPhone,
    collectsAddress: d.collectsAddress,
    collectsPayment: d.collectsPayment,
    collectsCookies: d.collectsCookies,
    purposes: JSON.stringify(d.purposes),
    thirdParties: JSON.stringify(d.thirdParties),
    usesMetrika: d.usesMetrika,
    usesGa: d.usesGa,
    usesMailing: d.usesMailing,
    rknNotifiedAt: d.rknNotifiedAt ? new Date(d.rknNotifiedAt) : null,
    consentMode: d.consentMode,
    consentText: d.consentText?.trim() || null,
  };

  const legal = await prisma.projectLegal.upsert({
    where: { projectId: project.id },
    update: data,
    // Публичный слаг выдаётся один раз при первом сохранении и больше не меняется:
    // на него уже могут стоять ссылки с сайта клиента.
    create: { ...data, projectId: project.id, publicSlug: generateLegalSlug() },
  });

  return NextResponse.json({ legal });
}
