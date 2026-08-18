// Публичная страница правового документа проекта: /l/<publicSlug>/privacy | offer | consent.
//
// Показывается последняя опубликованная версия — именно на этот адрес ведут ссылки с
// сайта клиента (в том числе из галочки согласия, которую подставляет SDK). Адрес
// постоянный: при переиздании документа меняется содержимое, а ссылка остаётся.
//
// Страница индексируется поисковиками как документ конкретного сайта, поэтому в заголовке
// стоит имя оператора, а внизу — отметка, что документ подготовлен в Logsy.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { docTypeFromSlug, LEGAL_DOC_SLUGS, LEGAL_DOC_TYPES } from "@/lib/legal";

export const dynamic = "force-dynamic";

/** Последняя версия документа проекта по публичному слагу, либо null. */
async function loadDoc(slug: string, docSlug: string) {
  const type = docTypeFromSlug(docSlug);
  if (!type) return null;

  const legal = await prisma.projectLegal.findUnique({
    where: { publicSlug: slug },
    select: { projectId: true, operatorName: true, siteUrl: true, publicSlug: true },
  });
  if (!legal) return null;

  const doc = await prisma.legalDoc.findFirst({
    where: { projectId: legal.projectId, type },
    orderBy: { version: "desc" },
  });
  if (!doc) return null;

  return { legal, doc };
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string; doc: string };
}): Promise<Metadata> {
  const found = await loadDoc(params.slug, params.doc);
  if (!found) return { title: "Документ не найден" };
  return {
    title: `${found.doc.title} — ${found.legal.operatorName}`,
    description: `${found.doc.title} для сайта ${found.legal.siteUrl ?? ""}. Редакция от ${found.doc.publishedAt.toLocaleDateString("ru-RU")}.`,
  };
}

export default async function LegalDocPage({
  params,
}: {
  params: { slug: string; doc: string };
}) {
  const found = await loadDoc(params.slug, params.doc);
  if (!found) notFound();
  const { legal, doc } = found;

  // Соседние документы проекта — чтобы с политики можно было перейти на оферту.
  const siblings = await prisma.legalDoc.findMany({
    where: { projectId: legal.projectId },
    orderBy: { version: "desc" },
    select: { type: true, title: true },
  });
  const otherTypes = LEGAL_DOC_TYPES.filter(
    (t) => t !== doc.type && siblings.some((s) => s.type === t),
  );

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
        <h1 className="text-2xl font-bold sm:text-3xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-slate-500">
          {legal.operatorName}
          {legal.siteUrl ? (
            <>
              {" · "}
              <a href={legal.siteUrl} className="text-brand hover:underline">
                {legal.siteUrl.replace(/^https?:\/\//, "")}
              </a>
            </>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Редакция {doc.version} от{" "}
          {doc.publishedAt.toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </header>

      {/* Текст документа — снимок, сохранённый при публикации версии. */}
      <article
        className="legal-doc space-y-4 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300"
        dangerouslySetInnerHTML={{ __html: doc.html }}
      />

      {otherTypes.length > 0 && (
        <nav className="mt-10 flex flex-wrap gap-3 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          {otherTypes.map((type) => (
            <Link
              key={type}
              href={`/l/${legal.publicSlug}/${LEGAL_DOC_SLUGS[type]}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
            >
              {siblings.find((s) => s.type === type)?.title}
            </Link>
          ))}
        </nav>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-400 dark:border-slate-800">
        Документ подготовлен в{" "}
        <Link href="/" className="hover:text-brand">
          Logsy
        </Link>{" "}
        по данным оператора. Ответственность за содержание и полноту сведений несёт оператор.
      </footer>
    </main>
  );
}
