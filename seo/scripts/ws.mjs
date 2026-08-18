// Сбор частотностей Wordstat через Яндекс.Директ API v4 Live.
// Токен берётся из .env проекта (YANDEX_OUATH).
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from "node:fs";

const ENV = "c:/Users/MAX/logsy/.env";
const OUT = process.argv[3] || "wordstat.json";
// Берём только допустимые для OAuth-токена символы: в .env к значению прилипал мусор.
const token = /y0__[A-Za-z0-9_.-]+/.exec(fs.readFileSync(ENV, "utf8"))[0];
const API = "https://api.direct.yandex.ru/live/v4/json/";
const GEO = [225]; // Россия

const seedsFile = process.argv[2];
const seeds = JSON.parse(fs.readFileSync(seedsFile, "utf8"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(method, param) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ method, token, param, locale: "ru" }),
    });
    const json = await res.json();
    if (json.error_code) {
      // 56 — превышен лимит запросов в секунду, 152/506 — лимиты, ждём
      if ([56, 506, 152].includes(json.error_code)) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      throw new Error(`${method}: [${json.error_code}] ${json.error_str} — ${json.error_detail || ""}`);
    }
    return json.data;
  }
  throw new Error(`${method}: превышены попытки`);
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

const batches = chunk(seeds, 10);
const collected = [];

// Чистим старую очередь отчётов, чтобы не упереться в лимит
try {
  const list = await call("GetWordstatReportList", null);
  for (const r of list || []) {
    try { await call("DeleteWordstatReport", r.ReportID); } catch {}
  }
  console.log(`очередь очищена: ${(list || []).length} отчётов`);
} catch (e) {
  console.log("список отчётов недоступен:", e.message);
}

const WAVE = 4; // одновременно в очереди
for (const wave of chunk(batches, WAVE)) {
  const ids = [];
  for (const phrases of wave) {
    try {
      const id = await call("CreateNewWordstatReport", { Phrases: phrases, GeoID: GEO });
      ids.push({ id, phrases });
      console.log(`создан отчёт ${id}: ${phrases.length} фраз`);
    } catch (e) {
      console.log("ошибка создания:", e.message);
    }
    await sleep(1200);
  }
  if (!ids.length) continue;

  // Ждём готовности
  const pending = new Set(ids.map((x) => x.id));
  for (let i = 0; i < 60 && pending.size; i++) {
    await sleep(6000);
    const list = await call("GetWordstatReportList", null);
    for (const r of list || []) {
      if (pending.has(r.ReportID) && r.StatusReport === "Done") pending.delete(r.ReportID);
    }
    console.log(`ожидание: осталось ${pending.size}`);
  }

  for (const { id } of ids) {
    try {
      const rep = await call("GetWordstatReport", id);
      for (const item of rep || []) {
        collected.push({
          phrase: item.Phrase,
          searchedWith: (item.SearchedWith || []).map((s) => ({ p: s.Phrase, n: s.Shows })),
          searchedAlso: (item.SearchedAlso || []).map((s) => ({ p: s.Phrase, n: s.Shows })),
        });
      }
      console.log(`получен отчёт ${id}`);
    } catch (e) {
      console.log(`ошибка чтения ${id}:`, e.message);
    }
    try { await call("DeleteWordstatReport", id); } catch {}
    await sleep(1000);
  }
  fs.writeFileSync(OUT, JSON.stringify(collected, null, 1), "utf8");
}

fs.writeFileSync(OUT, JSON.stringify(collected, null, 1), "utf8");
const total = collected.reduce((a, c) => a + c.searchedWith.length + c.searchedAlso.length, 0);
console.log(`\nГОТОВО: ${collected.length} базовых фраз, ${total} связанных запросов → ${OUT}`);
