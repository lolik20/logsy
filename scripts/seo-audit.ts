// Аудит заголовков: бренд в title и H1, дубли title, description и H1.
// Запуск: npx tsx scripts/seo-audit.ts
import fs from "node:fs";
import path from "node:path";
import { SEO_PAGES } from "../src/lib/seo/registry";

const BRAND = /logsy/i;

type Row = { url: string; title: string; h1: string; description: string };

const rows: Row[] = SEO_PAGES.map((p) => ({
  url: p.url,
  title: p.title,
  h1: p.h1,
  description: p.description,
}));

// Метаданные страниц, написанных вручную (docs, лендинги): вытаскиваем регулярками.
function scanManual(dir: string): Row[] {
  const out: Row[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...scanManual(full));
      continue;
    }
    if (entry.name !== "page.tsx") continue;
    const src = fs.readFileSync(full, "utf8");
    if (src.includes("seoMetadata(")) continue; // страницы движка уже учтены
    const title = /title:\s*["'`]([^"'`]+)["'`]/.exec(src)?.[1] ?? "";
    const description = /description:\s*\n?\s*["'`]([^"'`]+)["'`]/.exec(src)?.[1] ?? "";
    const h1 = /<h1[^>]*>\s*\n?\s*([^<{]+)/.exec(src)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    const url =
      "/" + path.relative(path.join("src", "app"), dir).split(path.sep).join("/");
    if (title || h1) out.push({ url: url === "/." ? "/" : url, title, h1, description });
  }
  return out;
}

const manual = scanManual(path.join("src", "app"));
const all = [...rows, ...manual];

console.log(`страниц в аудите: ${all.length} (движок ${rows.length}, вручную ${manual.length})\n`);

console.log("=== БРЕНД В TITLE ===");
const brandTitles = all.filter((r) => BRAND.test(r.title));
brandTitles.forEach((r) => console.log(`  ${r.url}\n     ${r.title}`));
if (!brandTitles.length) console.log("  нет");

console.log("\n=== БРЕНД В H1 ===");
const brandH1 = all.filter((r) => BRAND.test(r.h1));
brandH1.forEach((r) => console.log(`  ${r.url}\n     ${r.h1}`));
if (!brandH1.length) console.log("  нет");

console.log("\n=== БРЕНД В DESCRIPTION ===");
const brandDesc = all.filter((r) => BRAND.test(r.description));
brandDesc.forEach((r) => console.log(`  ${r.url}: ${r.description.slice(0, 90)}…`));
if (!brandDesc.length) console.log("  нет");

function dupes(field: keyof Row) {
  const map = new Map<string, string[]>();
  for (const r of all) {
    const v = (r[field] || "").trim().toLowerCase();
    if (!v) continue;
    map.set(v, [...(map.get(v) ?? []), r.url]);
  }
  return [...map.entries()].filter(([, urls]) => urls.length > 1);
}

for (const field of ["title", "description", "h1"] as const) {
  console.log(`\n=== ДУБЛИ ${field.toUpperCase()} ===`);
  const d = dupes(field);
  if (!d.length) console.log("  нет");
  d.forEach(([v, urls]) => console.log(`  «${v.slice(0, 70)}» → ${urls.join(", ")}`));
}

// Один запрос — одна страница: если ключ прошит в две страницы, они конкурируют между собой.
console.log("\n=== ОДИН КЛЮЧ НА ДВУХ СТРАНИЦАХ ===");
const byKeyword = new Map<string, string[]>();
for (const p of SEO_PAGES) {
  for (const k of p.keywords) {
    const key = k.trim().toLowerCase();
    byKeyword.set(key, [...(byKeyword.get(key) ?? []), p.url]);
  }
}
const shared = [...byKeyword.entries()].filter(([, urls]) => urls.length > 1);
if (!shared.length) console.log("  нет");
shared.forEach(([k, urls]) => console.log(`  «${k}» → ${urls.join(", ")}`));

// Похожие title: совпадение по первым трём словам — риск каннибализации.
console.log("\n=== БЛИЗКИЕ TITLE (первые 3 слова совпадают) ===");
const byHead = new Map<string, string[]>();
for (const r of all) {
  const head = r.title.toLowerCase().split(/\s+/).slice(0, 3).join(" ");
  if (!head) continue;
  byHead.set(head, [...(byHead.get(head) ?? []), r.url]);
}
const near = [...byHead.entries()].filter(([, urls]) => urls.length > 1);
if (!near.length) console.log("  нет");
near.forEach(([head, urls]) => console.log(`  «${head}…» → ${urls.join(", ")}`));
