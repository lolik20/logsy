// Правила обхода. Открыты лендинг, инструменты и документация; закрыты панель,
// служебные API и правовые документы клиентов (их индексирует сам клиент со своего
// сайта, дублировать их в нашем индексе смысла нет).

import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/api-docs";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/docs/", "/llms.txt", "/api/v1/openapi.json"],
        disallow: ["/dashboard", "/api/", "/l/", "/login", "/verify-contact", "/reset-password"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
