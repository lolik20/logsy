// Краулер карты страниц проекта. Один раз обходит домен проекта по внутренним ссылкам
// (BFS от корня), собирает пути страниц и их заголовки и складывает в модель ProjectPage.
// Ходит только по тому же хосту, пропускает файлы-ресурсы и внешние ссылки. Ограничен по
// числу страниц и общему времени, чтобы не подвесить запрос. HTML разбираем регэкспами —
// DOM-парсера в рантайме нет, а нам нужны только <a href> и <title>.

import { prisma } from "@/lib/prisma";
import { normalizePagePath, normalizePathname, pathDepth } from "@/lib/pages";

// Пределы обхода: чтобы краулер не ходил бесконечно по крупному сайту и не превышал
// разумное время запроса.
const MAX_PAGES = 200; // сколько страниц максимум обойти и сохранить
const MAX_DEPTH = 6; // максимальная глубина вложенности пути
const PAGE_TIMEOUT_MS = 8000; // таймаут одного HTTP-запроса
const TOTAL_BUDGET_MS = 25000; // общий бюджет времени обхода

export type CrawlResult = {
  found: number; // сколько страниц сохранено
  visited: number; // сколько URL реально загружено
  stopped: "done" | "limit" | "budget"; // причина остановки
};

/** Достаёт <title> из HTML (первый), обрезая пробелы. null — если нет. */
function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!m) return null;
  const t = m[1].replace(/\s+/g, " ").trim();
  return t ? t.slice(0, 300) : null;
}

/** Достаёт значения href всех <a> из HTML. */
function extractHrefs(html: string): string[] {
  const out: string[] = [];
  const re = /<a\b[^>]*?\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s">]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[2] ?? m[3] ?? m[4] ?? "";
    if (href) out.push(href);
  }
  return out;
}

/** Загружает страницу (только HTML). Возвращает тело или null (не HTML/ошибка/таймаут). */
async function fetchPage(url: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "LogsyBot/1.0 (+https://logsy.ru)", accept: "text/html" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Обходит домен проекта и обновляет карту страниц (ProjectPage). Страницы, найденные в
 * этом обходе, апсертятся с source=CRAWL и свежим lastCrawledAt. Прежние CRAWL-страницы,
 * которые в этом обходе не встретились, удаляются (сайт мог измениться). Страницы source=
 * SESSION (замеченные в сессиях, но не найденные краулером) не трогаем.
 */
export async function crawlProject(projectId: string): Promise<CrawlResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, domain: true },
  });
  if (!project) throw new Error("Проект не найден");

  const host = project.domain.toLowerCase();
  const base = `https://${host}`;
  const startedAt = Date.now();

  const queue: string[] = ["/"];
  const seen = new Set<string>(["/"]);
  // Найденные страницы: путь → { title, depth }.
  const found = new Map<string, { title: string | null; depth: number }>();
  let visited = 0;
  let stopped: CrawlResult["stopped"] = "done";

  while (queue.length > 0) {
    if (found.size >= MAX_PAGES) {
      stopped = "limit";
      break;
    }
    if (Date.now() - startedAt > TOTAL_BUDGET_MS) {
      stopped = "budget";
      break;
    }
    const path = queue.shift()!;
    const pageUrl = base + (path === "/" ? "" : path);
    const html = await fetchPage(pageUrl);
    visited += 1;
    if (html == null) continue;

    found.set(path, { title: extractTitle(html), depth: pathDepth(path) });

    for (const href of extractHrefs(html)) {
      const norm = normalizePagePath(href, pageUrl, host);
      if (!norm) continue;
      if (seen.has(norm)) continue;
      if (pathDepth(norm) > MAX_DEPTH) continue;
      seen.add(norm);
      queue.push(norm);
    }
  }

  // Если корень не отдал HTML (found пуст), всё равно фиксируем сам факт обхода без правок.
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const [path, info] of found) {
      await tx.projectPage.upsert({
        where: { projectId_path: { projectId, path } },
        create: {
          projectId,
          path: normalizePathname(path),
          title: info.title,
          depth: info.depth,
          source: "CRAWL",
          lastCrawledAt: now,
        },
        update: { title: info.title, depth: info.depth, source: "CRAWL", lastCrawledAt: now },
      });
    }
    // Убираем прежние CRAWL-страницы, которых в этом обходе не было.
    if (found.size > 0) {
      await tx.projectPage.deleteMany({
        where: {
          projectId,
          source: "CRAWL",
          path: { notIn: Array.from(found.keys()).map(normalizePathname) },
        },
      });
    }
  });

  return { found: found.size, visited, stopped };
}
