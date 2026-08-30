// Аудит посадочных страниц: контракт (длины title/description), покрытие
// маршрутами (страница в реестре без маршрута = 404 в sitemap) и нереализованный
// потенциал прошивки (строки pagemap.json без живой страницы).
// Запуск: npx tsx scripts/seo-pagemap-audit.ts
import fs from "node:fs";
import path from "node:path";
import { SEO_PAGES, EXTERNAL_PAGES, pageExists } from "../src/lib/seo/registry";

type MapRow = {
  url: string;
  h1: string;
  t: string;
  total: number;
  focus: number;
  note: string;
  core: [string, number, string][];
  tail: [string, number, string][];
};
const rows: MapRow[] = JSON.parse(
  fs.readFileSync(path.join("seo", "scripts", "pagemap.json"), "utf8"),
);
const byUrl = new Map(rows.map((r) => [r.url, r]));

// ── Маршруты приложения: src/app/**/page.tsx → шаблоны адресов ──
const routes: string[] = [];
function walk(dir: string, url: string) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (e.name.startsWith("(")) walk(path.join(dir, e.name), url);
      else walk(path.join(dir, e.name), url + "/" + e.name);
    } else if (e.name === "page.tsx") routes.push(url || "/");
  }
}
walk(path.join("src", "app"), "");
const matchesRoute = (u: string) => {
  const segs = u.split("/").filter(Boolean);
  return routes.some((r) => {
    const rs = r.split("/").filter(Boolean);
    if (rs.length !== segs.length) return false;
    return rs.every((s, i) => s.startsWith("[") || s === segs[i]);
  });
};

// ── 1. Контракт ──
console.log("═══ 1. НАРУШЕНИЯ КОНТРАКТА (types.ts) ═══");
for (const p of SEO_PAGES) {
  const bad: string[] = [];
  if (p.title.length > 60) bad.push(`title ${p.title.length} зн.`);
  if (p.description.length < 140 || p.description.length > 170)
    bad.push(`description ${p.description.length} зн.`);
  if (!p.faq.length) bad.push("нет FAQ");
  if (!p.sections.length) bad.push("нет секций");
  if (bad.length) console.log(` ${p.url}: ${bad.join("; ")}`);
}

// ── 2. Дубли и маршруты ──
console.log("\n═══ 2. СТРАНИЦЫ РЕЕСТРА БЕЗ МАРШРУТА (404 в sitemap) ═══");
const seen = new Set<string>();
for (const p of SEO_PAGES) {
  if (seen.has(p.url)) console.log(` ДУБЛЬ в реестре: ${p.url}`);
  seen.add(p.url);
  if (!matchesRoute(p.url)) console.log(` ${p.url}`);
}
console.log("\n═══ 2а. EXTERNAL_PAGES без маршрута ═══");
for (const u of EXTERNAL_PAGES) if (!matchesRoute(u)) console.log(` ${u}`);

// ── 3. Битая перелинковка (мертвые related, которых нет и в прошивке) ──
console.log("\n═══ 3. RELATED-ССЫЛКИ, КОТОРЫХ НЕТ ДАЖЕ В ПРОШИВКЕ ═══");
for (const p of SEO_PAGES)
  for (const r of p.related)
    if (!pageExists(r) && !byUrl.has(r)) console.log(` ${p.url} → ${r}`);

// ── 4. Живые страницы без прошивки ──
console.log("\n═══ 4. ЖИВЫЕ СТРАНИЦЫ БЕЗ СТРОКИ В PAGEMAP ═══");
for (const p of SEO_PAGES) if (!byUrl.has(p.url)) console.log(` ${p.url}`);

// ── 5. Потенциал: прошито, но страницы нет ──
console.log("\n═══ 5. ПРОШИТО, НО СТРАНИЦЫ НЕТ (по целевой частоте) ═══");
const live = new Set(SEO_PAGES.map((p) => p.url));
const missing = rows.filter((r) => !live.has(r.url) && !EXTERNAL_PAGES.has(r.url));
missing.sort((a, b) => b.focus - a.focus);
let lost = 0;
for (const r of missing) {
  lost += r.focus;
  console.log(
    ` ${String(r.focus).padStart(7)} ${String(r.total).padStart(8)} ${r.url}  [${r.t}] ${r.note ? "⚠ " + r.note : ""}`,
  );
}
console.log(`\n страниц не хватает: ${missing.length}, недобранная целевая частота: ${lost}`);
console.log(` живых страниц в реестре: ${SEO_PAGES.length}, маршрутов page.tsx: ${routes.length}`);
