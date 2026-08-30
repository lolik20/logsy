// Расширение ключей посадочных страниц частотностями Яндекс.Wordstat.
//
// Источник — seo/scripts/pagemap.json: карта, где каждый запрос закреплён ровно за одной
// страницей (сбор — seo/scripts/ws.mjs через Директ API v4 Live, регион 225 «Россия»).
// Отсюда берётся ВЧ-ядро и НЧ-хвост для живых страниц движка и складывается в
// src/content/seo/keywords.ts. Ручные ключи в src/content/seo/*.ts остаются как есть —
// сгенерированные добавляются к ним в реестре.
//
// Запуск: npx tsx scripts/seo-keywords.ts
import fs from "node:fs";
import path from "node:path";
import { SEO_PAGES } from "../src/lib/seo/registry";

type MapRow = {
  url: string;
  core: [string, number, string][];
  tail: [string, number, string][];
};

const rows: MapRow[] = JSON.parse(
  fs.readFileSync(path.join("seo", "scripts", "pagemap.json"), "utf8"),
);
const byUrl = new Map(rows.map((r) => [r.url, r]));

// Мусор, доживший до карты: чужие бренды, бытовые и госинтенты, омонимы.
// Частота у таких фраз реальная, но приходят по ним не наши люди.
// Границы слов через (^| ) — латинский \b на кириллице не срабатывает.
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
  // Навигационные хвосты: человек ищет сам сервис, а не решение задачи
  /(^| )(https?|www)( |$)|\.com( |$)|^claudecode$|(^| )github( |$)|(^| )install( |$)|(^| )login( |$)|(^| )free( |$)|(^| )limit( |$)/i,
  // Чужие бренды в связке «сервис недоступен» — тот же интент, но не про наш сайт
  /(яндекс|гугл|google|вконтакте) (недоступен|не работает)|недоступен сайт (google|гугл|яндекс)|сайт (яндекс|гугл|google) недоступен/i,
  // Обрубки автодополнения: «не работает сайт 2», «dns сервер не отвечает 10»
  /( \d| \d \d)$/,
];

// Точечные исключения: запрос прошит верно, но для опоры текста бесполезен.
const PAGE_STOP: Record<string, RegExp> = {
  "/uptime/api-monitoring": /текст|чек|development|(^| )key( |$)|ключ|forbidden|error/i,
  "/uptime/form-monitoring": /воронк|лид|конверси|персональн|инцидент/i,
  "/feedback-widget": /платформы обратной связи/i,
  "/session-replay": /официальный|через сайт|пк на сайте/i,
  "/site-audit": /(^| )(seo|сео|ии)( |$)|под ии/i,
  "/free": /(^| )(seo|сео)( |$)/i,
  "/monitoring-from-russia": /статистик|цен |claude code|cursor|replit/i,
  "/for-ecommerce": /online trade/i,
  "/errors/connection-refused": /базы данных/i,
  "/tools/dns": /403|forbidden/i,
  "/help/site-down": /видео|работа$/i,
  "/help/site-unavailable": /google|гугл|яндекс/i,
  "/integrations/claude-code": /(^| )(ai|cli|com|skills)( |$)|open claude|anthropic|mcp servers/i,
};

// Ключи, которые страница уже несёт руками, повторять незачем.
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const HF_LIMIT = 6; // сколько ВЧ/СЧ фраз (≥1000 показов) берём на страницу
const LF_LIMIT = 10; // сколько НЧ и мНЧ (<1000)

const out: Record<string, [string, number][]> = {};
let total = 0;

for (const page of SEO_PAGES) {
  const row = byUrl.get(page.url);
  if (!row) continue;
  const own = new Set(page.keywords.map(norm));
  const seen = new Set<string>();
  const hf: [string, number][] = [];
  const lf: [string, number][] = [];

  const pageStop = PAGE_STOP[page.url];
  for (const [phrase, shows] of [...row.core, ...row.tail]) {
    const key = norm(phrase);
    if (own.has(key) || seen.has(key) || shows <= 0) continue;
    if (STOP.some((re) => re.test(key))) continue;
    if (pageStop?.test(key)) continue;
    seen.add(key);
    const bucket = shows >= 1000 ? hf : lf;
    if (bucket.length < (shows >= 1000 ? HF_LIMIT : LF_LIMIT)) bucket.push([phrase, shows]);
  }

  const list = [...hf, ...lf].sort((a, b) => b[1] - a[1]);
  if (list.length) {
    out[page.url] = list;
    total += list.length;
  }
}

const lines: string[] = [
  "// Ключевые запросы страниц с частотностью Яндекс.Wordstat: ВЧ-ядро и НЧ-хвост.",
  "//",
  "// Файл собирается скриптом scripts/seo-keywords.ts из seo/scripts/pagemap.json —",
  "// карты, где каждый запрос закреплён ровно за одной страницей. Частота снята через",
  "// Яндекс.Директ API v4 Live (CreateNewWordstatReport), регион 225 «Россия», широкое",
  "// соответствие. Руками не правим: правим прошивку в seo/scripts/pages.mjs и пересобираем.",
  "//",
  "// В разметку запросы не идут — это опора для заголовков, вводных абзацев и FAQ.",
  "",
  "/** Адрес страницы → пары «запрос, показов в месяц», по убыванию частоты. */",
  "export const WORDSTAT_KEYWORDS: Record<string, [string, number][]> = {",
];
for (const [url, list] of Object.entries(out)) {
  lines.push(`  ${JSON.stringify(url)}: [`);
  for (const [phrase, shows] of list) lines.push(`    [${JSON.stringify(phrase)}, ${shows}],`);
  lines.push("  ],");
}
lines.push("};", "");

fs.writeFileSync(path.join("src", "content", "seo", "keywords.ts"), lines.join("\n"), "utf8");
console.log(`страниц с ключами: ${Object.keys(out).length}, запросов добавлено: ${total}`);
