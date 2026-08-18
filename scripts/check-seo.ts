// Проверка посадочных страниц перед выкатом: дубли адресов, длина title и description,
// ссылки на ненаписанные страницы, полнота FAQ. Запуск: npx tsx scripts/check-seo.ts
import { SEO_PAGES, pageExists } from "../src/lib/seo/registry";

const urls = SEO_PAGES.map((p) => p.url);
const dupes = urls.filter((u, i) => urls.indexOf(u) !== i);
console.log("страниц в реестре:", SEO_PAGES.length, "| дубли:", dupes.length ? dupes.join(", ") : "нет");

const longTitles = SEO_PAGES.filter((p) => p.title.length > 70).map((p) => `${p.url} (${p.title.length})`);
console.log("слишком длинные title (>70):", longTitles.length ? longTitles.join("; ") : "нет");

const shortDesc = SEO_PAGES.filter((p) => p.description.length < 110 || p.description.length > 200)
  .map((p) => `${p.url} (${p.description.length})`);
console.log("description вне 110–200 знаков:", shortDesc.length ? shortDesc.join("; ") : "нет");

const dead = new Set<string>();
for (const p of SEO_PAGES) for (const r of p.related) if (!pageExists(r)) dead.add(r);
console.log("ссылки на ненаписанные страницы (скрываются в рендере):", [...dead].join(", ") || "нет");

const thinFaq = SEO_PAGES.filter((p) => p.faq.length < 3).map((p) => p.url);
console.log("страниц с FAQ меньше трёх:", thinFaq.length ? thinFaq.join(", ") : "нет");
