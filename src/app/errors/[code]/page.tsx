// Раздел /errors: страницы берутся из реестра по слагу.
// Так карта может опережать реализацию — на несуществующий слаг отдаётся 404.

import { notFound } from "next/navigation";
import { SeoPage } from "@/components/seo/SeoPage";
import { getByPath, slugsUnder } from "@/lib/seo/registry";
import { seoMetadata } from "@/lib/seo/route";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { code: string } }) {
  return seoMetadata(`/errors/${params.code}`);
}

export function generateStaticParams() {
  return slugsUnder("/errors").map((slug) => ({ code: slug }));
}

export default function Page({ params }: { params: { code: string } }) {
  const content = getByPath("/errors", params.code);
  if (!content) notFound();
  return <SeoPage content={content} />;
}
