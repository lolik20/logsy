// Сверка текстов посадочных с базой Wordstat (pagemap.json):
// покрывает ли текст страницы слова её топ-запросов. Стемминг грубый — по префиксу.
// Запуск: npx tsx scripts/seo-coverage.ts
import fs from "node:fs";
import path from "node:path";
import { SEO_PAGES } from "../src/lib/seo/registry";

type MapRow = { url: string; core: [string, number, string][]; tail: [string, number, string][] };
const rows: MapRow[] = JSON.parse(
  fs.readFileSync(path.join("seo", "scripts", "pagemap.json"), "utf8"),
);
const byUrl = new Map(rows.map((r) => [r.url, r]));

const STOPWORDS = new Set(["на", "в", "и", "не", "с", "для", "по", "от", "что", "как", "это", "ли", "из", "за", "о", "об", "то", "же"]);
const stem = (w: string) => {
  const s = w.toLowerCase().replace(/ё/g, "е");
  return s.length <= 4 ? s : s.slice(0, Math.max(4, Math.ceil(s.length * 0.6)));
};

function pageText(p: (typeof SEO_PAGES)[number]): string {
  const parts: string[] = [p.title, p.h1, p.lead, p.description, ...p.keywords];
  for (const s of p.sections) {
    parts.push(s.title, s.body ?? "", s.code ?? "", s.note ?? "", ...(s.bullets ?? []));
    if (s.table) parts.push(...s.table.head, ...s.table.rows.flat());
  }
  for (const f of p.faq) parts.push(f.q, f.a);
  return parts.join(" ").toLowerCase().replace(/ё/g, "е");
}

let flagged = 0;
for (const p of SEO_PAGES) {
  const row = byUrl.get(p.url);
  if (!row) continue;
  const text = pageText(p);
  const textStems = new Set(text.split(/[^a-zа-я0-9_]+/i).filter(Boolean).map(stem));
  // Топ-5 незамутнённых запросов по частоте
  const queries = [...row.core, ...row.tail]
    .filter(([, n, t]) => n > 0 && t !== "mix")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const misses: string[] = [];
  for (const [phrase, n] of queries) {
    const words = phrase
      .toLowerCase()
      .split(/[^a-zа-яё0-9_.]+/i)
      .filter((w) => w && !STOPWORDS.has(w));
    const missing = words.filter((w) => !textStems.has(stem(w)) && !text.includes(w));
    if (missing.length / words.length > 0.34) misses.push(`«${phrase}» (${n}): нет [${missing.join(", ")}]`);
  }
  if (misses.length) {
    flagged++;
    console.log(p.url);
    for (const m of misses) console.log("   " + m);
  }
}
console.log(`\nстраниц с пробелами покрытия: ${flagged} из ${SEO_PAGES.length}`);
