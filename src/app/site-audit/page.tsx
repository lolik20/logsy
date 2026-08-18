// Посадочная страница /site-audit. Текст лежит в src/content/seo/*, рисует <SeoPage>.

import { notFound } from "next/navigation";
import { SeoPage } from "@/components/seo/SeoPage";
import { getSeoPage } from "@/lib/seo/registry";
import { seoMetadata } from "@/lib/seo/route";

export const dynamic = "force-dynamic";
export const metadata = seoMetadata("/site-audit");

export default function Page() {
  const content = getSeoPage("/site-audit");
  if (!content) notFound();
  return <SeoPage content={content} />;
}
