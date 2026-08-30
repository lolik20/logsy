// Проверка SEO-веса страниц: свежие частоты Wordstat через Яндекс.Директ API v4 Live.
//
// Вес страницы — сумма месячных показов (регион 225 «Россия», широкое соответствие)
// по её запросам: ручные ключи из реестра + сгенерированные из src/content/seo/keywords.ts;
// для страниц вне движка (/, /speed-test, …) — ядро и верх хвоста из seo/scripts/pagemap.json.
// Старые значения берутся из pagemap.json — по ним считается динамика.
//
// Запуск: npx tsx scripts/seo-weight.ts  →  seo/weight.json + таблица в консоль.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "node:fs";
import path from "node:path";
import { SEO_PAGES, EXTERNAL_PAGES } from "../src/lib/seo/registry";
import { WORDSTAT_KEYWORDS } from "../src/content/seo/keywords";

// Берём только допустимые для OAuth-токена символы: в .env к значению прилипал мусор.
const token = /y0__[A-Za-z0-9_.-]+/.exec(fs.readFileSync(".env", "utf8"))![0];
const API = "https://api.direct.yandex.ru/live/v4/json/";
const GEO = [225];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Старые частоты: карта запрос→показы из последнего съёма ────────────────
type MapRow = { url: string; core: [string, number, string][]; tail: [string, number, string][] };
const rows: MapRow[] = JSON.parse(
  fs.readFileSync(path.join("seo", "scripts", "pagemap.json"), "utf8"),
);
const oldFreq = new Map<string, number>();
for (const r of rows) for (const [p, n] of [...r.core, ...r.tail]) oldFreq.set(norm(p), n);

// Мусорные интенты — копия STOP из scripts/seo-keywords.ts, фильтрует хвост внешних страниц.
const STOP = [
  /гибдд|аэрофлот|одноклассник|вайлдберриз|wildberries|(^| )wb( |$)|озон|ozon|(^| )vk( |$)|(^| )вк( |$)|почта росси|кинотеатр|мвидео|днс магазин|dns shop|онлайнтрейд|look online|desport|метрион|cdvpodarok|меззаторре|мои игрушки|мои инструменты|тему интернет|фишинг|deviantart|маджестик|теско/i,
  /госуслуг|государствен|муниципальн|инвалид|казначейств|росказна|налог|росстат|правовой информации|закупок|образовательн|школ|медицин|врач|юридических лиц|предоставления услуг|доступности (объектов|ресурсов)/i,
  /(^| )1с( |$)|active directory|(^| )imap( |$)|(^| )smtp( |$)|контроллера домена|windows|виндовс|устройство|компьютер|ноутбук|роутер|телефонах?|айфон|андроид|принтер|игр[аыу]|игров|гранта|стандофф|standoff|роблокс|даркнет|торрент|при установке|при запуске/i,
  /допуск|масл[аоы]|openai|(^| )open api|api sq|развес|честный знак|контур|диадок|(^| )max api|яндекс маркет|маркетплейс|zabbix|prometheus|grafana|kibana|datadog|new relic/i,
  /эквайринг (это|что это)|эквайринговый терминал|ошибк[аи] валидации|валидация (это|данных|что это)|редирект (это|что это)|что такое редирект|таск трекер это|доменное имя$|api что это/i,
  /себя|порно|знакомств|гороскоп|аниме|погод|футбол|рецепт|вакансии|резюме/i,
  /web himgrad|реестр инвалидов|абонент не отвечает|зашифрованного архива|область логирования|unexpected store exception|ошибка 1\.500/i,
  /купить|скачать|бесплатно скачать|цена на|стоимость курса|курсы /i,
  /маркировк|(^| )км( |$)|транспортн|стройк|бюджетн|проверка адреса|api проверка адреса/i,
  /(^| )(https?|www)( |$)|\.com( |$)|^claudecode$|(^| )github( |$)|(^| )install( |$)|(^| )login( |$)|(^| )free( |$)|(^| )limit( |$)/i,
  /(яндекс|гугл|google|вконтакте) (недоступен|не работает)|недоступен сайт (google|гугл|яндекс)|сайт (яндекс|гугл|google) недоступен/i,
  /( \d| \d \d)$/,
];

// ── Запросы страниц ────────────────────────────────────────────────────────
const pagePhrases = new Map<string, Map<string, string>>(); // url → (norm → фраза как есть)
const add = (url: string, phrase: string) => {
  const key = norm(phrase);
  if (!key) return;
  if (!pagePhrases.has(url)) pagePhrases.set(url, new Map());
  const m = pagePhrases.get(url)!;
  if (!m.has(key)) m.set(key, phrase.trim());
};

for (const p of SEO_PAGES) {
  for (const k of p.keywords) add(p.url, k);
  for (const [k] of WORDSTAT_KEYWORDS[p.url] ?? []) add(p.url, k);
}

// Страницы вне движка: только реальные (из EXTERNAL_TITLES) — карта опережает
// реализацию, и вес несуществующих страниц здесь не нужен. Ядро целиком + верх хвоста.
const TAIL_LIMIT = 10;
const covered = new Set(SEO_PAGES.map((p) => p.url));
for (const r of rows) {
  if (covered.has(r.url) || !EXTERNAL_PAGES.has(r.url)) continue;
  for (const [p] of r.core) add(r.url, p);
  let n = 0;
  for (const [p] of r.tail) {
    if (n >= TAIL_LIMIT) break;
    if (STOP.some((re) => re.test(norm(p)))) continue;
    add(r.url, p);
    n++;
  }
}

// Уникальный список фраз (одна фраза может числиться за несколькими страницами — из ручных ключей)
const phraseToPages = new Map<string, string[]>();
const phraseText = new Map<string, string>();
for (const [url, m] of pagePhrases) {
  for (const [key, text] of m) {
    phraseText.set(key, text);
    (phraseToPages.get(key) ?? phraseToPages.set(key, []).get(key)!).push(url);
  }
}
const allPhrases = [...phraseText.values()];
console.log(`страниц: ${pagePhrases.size}, уникальных фраз: ${allPhrases.length}`);

// ── Директ API v4 Live ─────────────────────────────────────────────────────
async function call(method: string, param: unknown): Promise<any> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ method, token, param, locale: "ru" }),
    });
    const json: any = await res.json();
    if (json.error_code) {
      // 56 — превышен лимит запросов в секунду, 152/506 — лимиты, ждём
      if ([56, 506, 152].includes(json.error_code)) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      throw new Error(
        `${method}: [${json.error_code}] ${json.error_str} — ${json.error_detail || ""}`,
      );
    }
    return json.data;
  }
  throw new Error(`${method}: превышены попытки`);
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
// Чистим старую очередь отчётов, чтобы не упереться в лимит
try {
  const list = await call("GetWordstatReportList", null);
  for (const r of list || []) {
    try {
      await call("DeleteWordstatReport", r.ReportID);
    } catch {}
  }
  console.log(`очередь очищена: ${(list || []).length} отчётов`);
} catch (e: any) {
  console.log("список отчётов недоступен:", e.message);
}

const fresh = new Map<string, number>(); // norm → показов сейчас
const batches = chunk(allPhrases, 10);
const WAVE = 4;
let done = 0;

for (const wave of chunk(batches, WAVE)) {
  const ids: { id: number; phrases: string[] }[] = [];
  for (const phrases of wave) {
    try {
      const id = await call("CreateNewWordstatReport", { Phrases: phrases, GeoID: GEO });
      ids.push({ id, phrases });
    } catch (e: any) {
      console.log("ошибка создания:", e.message);
    }
    await sleep(1200);
  }
  if (!ids.length) continue;

  const pending = new Set(ids.map((x) => x.id));
  for (let i = 0; i < 60 && pending.size; i++) {
    await sleep(6000);
    const list = await call("GetWordstatReportList", null);
    for (const r of list || []) {
      if (pending.has(r.ReportID) && r.StatusReport === "Done") pending.delete(r.ReportID);
    }
  }

  for (const { id, phrases } of ids) {
    try {
      const rep = await call("GetWordstatReport", id);
      for (const item of rep || []) {
        const key = norm(item.Phrase);
        const sw: { Phrase: string; Shows: number }[] = item.SearchedWith || [];
        // Частота самой фразы — её собственная строка в SearchedWith (обычно первая)
        const self = sw.find((s) => norm(s.Phrase) === key) ?? sw[0];
        fresh.set(key, self?.Shows ?? 0);
      }
    } catch (e: any) {
      console.log(`ошибка чтения ${id}:`, e.message);
      for (const p of phrases) if (!fresh.has(norm(p))) fresh.set(norm(p), -1); // не сняли
    }
    try {
      await call("DeleteWordstatReport", id);
    } catch {}
    await sleep(1000);
  }
  done += ids.length;
  console.log(`снято отчётов: ${done}/${batches.length}, фраз с частотой: ${fresh.size}`);
}

// ── Свод по страницам ──────────────────────────────────────────────────────
type PageReport = {
  url: string;
  weight: number;
  oldWeight: number;
  phrases: { phrase: string; shows: number; old: number | null }[];
};
const report: PageReport[] = [];
for (const [url, m] of pagePhrases) {
  const phrases = [...m.entries()].map(([key, text]) => ({
    phrase: text,
    shows: Math.max(fresh.get(key) ?? 0, 0),
    old: oldFreq.get(key) ?? null,
  }));
  phrases.sort((a, b) => b.shows - a.shows);
  report.push({
    url,
    weight: phrases.reduce((a, p) => a + p.shows, 0),
    oldWeight: phrases.reduce((a, p) => a + (p.old ?? 0), 0),
    phrases,
  });
}
report.sort((a, b) => b.weight - a.weight);
fs.writeFileSync(path.join("seo", "weight.json"), JSON.stringify(report, null, 1), "utf8");

const pct = (w: number, o: number) => (o ? `${w >= o ? "+" : ""}${Math.round(((w - o) / o) * 100)}%` : "—");
console.log("\nурл\tфраз\tвес\tбыло\tдинамика");
for (const r of report) {
  console.log(`${r.url}\t${r.phrases.length}\t${r.weight}\t${r.oldWeight}\t${pct(r.weight, r.oldWeight)}`);
}
const totalW = report.reduce((a, r) => a + r.weight, 0);
const totalO = report.reduce((a, r) => a + r.oldWeight, 0);
console.log(`\nИТОГО: вес ${totalW}, было ${totalO} (${pct(totalW, totalO)}) → seo/weight.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
