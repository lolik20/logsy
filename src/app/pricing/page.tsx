// Посадочная страница /pricing. Текст лежит в src/content/seo/*, рисует <SeoPage>.

import { notFound } from "next/navigation";
import { SeoPage } from "@/components/seo/SeoPage";
import { getSeoPage } from "@/lib/seo/registry";
import { seoMetadata } from "@/lib/seo/route";

export const dynamic = "force-dynamic";
export const metadata = seoMetadata("/pricing");

export default function Page() {
  const content = getSeoPage("/pricing");
  if (!content) notFound();
  return <SeoPage content={content} />;
}
