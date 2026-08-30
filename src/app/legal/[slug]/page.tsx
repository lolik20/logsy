// Раздел /legal: страницы берутся из реестра по слагу.
// Так карта может опережать реализацию — на несуществующий слаг отдаётся 404.

import { notFound } from "next/navigation";
import { SeoPage } from "@/components/seo/SeoPage";
import { getByPath, slugsUnder } from "@/lib/seo/registry";
import { seoMetadata } from "@/lib/seo/route";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { slug: string } }) {
  return seoMetadata(`/legal/${params.slug}`);
}

export function generateStaticParams() {
  return slugsUnder("/legal").map((slug) => ({ slug: slug }));
}

export default function Page({ params }: { params: { slug: string } }) {
  const content = getByPath("/legal", params.slug);
  if (!content) notFound();
  return <SeoPage content={content} />;
}
