// Карта сайта для поисковиков. Публичные страницы перечислены явно: панель и
// документы проектов (/l/<slug>/…) сюда не попадают — они не для общего индекса.
//
// Документация API включена намеренно: раньше она жила только внутри панели, за
// авторизацией, и поисковики её не видели.

import type { MetadataRoute } from "next";
import { API_ENDPOINTS, appUrl } from "@/lib/api-docs";
import { SEO_PAGES } from "@/lib/seo/registry";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const now = new Date();

  const pages: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
    { path: "/", priority: 1, changeFrequency: "weekly" },
    { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-owners", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-marketers", priority: 0.8, changeFrequency: "monthly" },
    { path: "/for-developers", priority: 0.8, changeFrequency: "monthly" },
    { path: "/speed-test", priority: 0.9, changeFrequency: "weekly" },
    { path: "/site-check", priority: 0.9, changeFrequency: "weekly" },
    { path: "/docs/api", priority: 0.7, changeFrequency: "monthly" },
    { path: "/docs/for-agents", priority: 0.7, changeFrequency: "monthly" },
    { path: "/offer", priority: 0.3, changeFrequency: "yearly" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
    { path: "/register", priority: 0.5, changeFrequency: "yearly" },
    { path: "/login", priority: 0.3, changeFrequency: "yearly" },
  ];

  return [
    ...pages.map((p) => ({
      url: `${base}${p.path}`,
      lastModified: now,
      changeFrequency: p.changeFrequency,
      priority: p.priority,
    })),
    ...API_ENDPOINTS.map((e) => ({
      url: `${base}/docs/api/${e.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    // Посадочные страницы: продуктовые, аварийные, инструменты и гайды.
    ...SEO_PAGES.map((p) => ({
      url: `${base}${p.url}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: p.url.startsWith("/blog/") ? 0.5 : 0.7,
    })),
  ];
}
