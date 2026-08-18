// Посадочная страница /uptime/api-monitoring. Текст лежит в src/content/seo/*, рисует <SeoPage>.

import { notFound } from "next/navigation";
import { SeoPage } from "@/components/seo/SeoPage";
import { getSeoPage } from "@/lib/seo/registry";
import { seoMetadata } from "@/lib/seo/route";

export const dynamic = "force-dynamic";
export const metadata = seoMetadata("/uptime/api-monitoring");

export default function Page() {
  const content = getSeoPage("/uptime/api-monitoring");
  if (!content) notFound();
  return <SeoPage content={content} />;
}
