// Метаданные посадочной страницы по её адресу: title, description, канонический адрес
// и Open Graph. Вынесено отдельно, чтобы файлы маршрутов оставались в три строки.

import type { Metadata } from "next";
import { getSeoPage } from "@/lib/seo/registry";

export function seoMetadata(url: string): Metadata {
  const page = getSeoPage(url);
  if (!page) return { title: "Страница не найдена" };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: page.url },
    openGraph: {
      title: page.title,
      description: page.description,
      url: page.url,
      type: "article",
      locale: "ru_RU",
      siteName: "Logsy",
    },
  };
}
