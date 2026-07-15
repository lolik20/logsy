import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { CrawlButton } from "@/components/CrawlButton";
import { PagesMap } from "@/components/PagesMap";
import { retentionHours } from "@/lib/logging";
import {
  aggregatePageLoads,
  aggregateCriticalRequests,
  aggregatePageCounts,
  buildPageTree,
  type PageInput,
  type PageLoadMetric,
  type CriticalRequest,
  type PageCounts,
} from "@/lib/pages";

export const dynamic = "force-dynamic";

// Сколько «сырых» событий метрик берём для агрегации карты. Ограничение — чтобы на
// шумном проекте страница оставалась быстрой; события отсортированы от свежих.
const MAX_METRIC_EVENTS = 10000;

export default async function PagesPage({
  params,
}: {
  params: { id: string };
}) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const isOwner = project.userId === userId;

  // Страницы, найденные краулером (карта каталогов/подкаталогов).
  const crawled = await prisma.projectPage.findMany({
    where: { projectId: project.id },
    orderBy: { path: "asc" },
    select: { path: true, title: true, source: true },
  });

  // Метрики берём из событий сессий за срок хранения тарифа.
  const since = new Date(Date.now() - retentionHours(project.tier) * 60 * 60 * 1000);
  const metricEvents = await prisma.logEvent.findMany({
    where: {
      projectId: project.id,
      createdAt: { gte: since },
      type: {
        in: [
          "PAGE_LOAD",
          "SLOW_RESOURCE",
          "SLOW_REQUEST",
          "HTTP_ERROR",
          "ERROR",
          "UNHANDLED_REJECTION",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_METRIC_EVENTS,
    select: { type: true, url: true, route: true, method: true, durationMs: true },
  });

  const loadEvents = metricEvents.filter((e) => e.type === "PAGE_LOAD");
  // Критические запросы/файлы строятся из событий с URL запроса (route): медленные
  // запросы/ресурсы и упавшие запросы. JS-ошибки без route сюда не попадают.
  const slowEvents = metricEvents.filter(
    (e) => e.type === "SLOW_RESOURCE" || e.type === "SLOW_REQUEST" || e.type === "HTTP_ERROR",
  );

  const metricsMap = aggregatePageLoads(loadEvents);
  const criticalMap = aggregateCriticalRequests(slowEvents);
  // Счётчики ошибок/медленных по каждой странице (для агрегатов у каталогов).
  const countsMap = aggregatePageCounts(metricEvents);

  // Объединяем источники путей: краулер + пути, замеченные только в сессиях.
  const pageByPath = new Map<string, PageInput>();
  for (const p of crawled) {
    pageByPath.set(p.path, { path: p.path, title: p.title, source: p.source });
  }
  for (const path of metricsMap.keys()) {
    if (!pageByPath.has(path)) pageByPath.set(path, { path, title: null, source: "SESSION" });
  }
  for (const path of criticalMap.keys()) {
    if (!pageByPath.has(path)) pageByPath.set(path, { path, title: null, source: "SESSION" });
  }

  const tree = buildPageTree(Array.from(pageByPath.values()));

  // Map → простые объекты для передачи в клиентский компонент.
  const metrics: Record<string, PageLoadMetric> = {};
  for (const [path, m] of metricsMap) metrics[path] = m;
  const critical: Record<string, CriticalRequest[]> = {};
  for (const [path, list] of criticalMap) critical[path] = list;
  const counts: Record<string, PageCounts> = {};
  for (const [path, c] of countsMap) counts[path] = c;

  const lastCrawl = await prisma.projectPage.aggregate({
    where: { projectId: project.id, source: "CRAWL" },
    _max: { lastCrawledAt: true },
    _count: { _all: true },
  });

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="pages"
      />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Карта загрузки страниц</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Бот один раз обходит домен по внутренним ссылкам и собирает страницы
            (каталог и подкаталоги). Для каждой страницы показано среднее время до
            прогрузки конечного контента по сессиям пользователей. Нажмите на
            страницу, чтобы увидеть критические запросы и статические файлы, которые
            грузятся дольше 1 секунды.
          </p>
        </div>
        {isOwner && (
          <CrawlButton
            projectId={project.id}
            crawledCount={lastCrawl._count._all}
            lastCrawledAt={
              lastCrawl._max.lastCrawledAt
                ? lastCrawl._max.lastCrawledAt.toISOString()
                : null
            }
          />
        )}
      </div>

      {pageByPath.size === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700">
          Карта пуста. {isOwner ? "Нажмите «Собрать карту», чтобы бот обошёл сайт и собрал страницы." : "Владелец ещё не собирал карту сайта."}
        </p>
      ) : (
        <PagesMap
          domain={project.domain}
          tree={tree}
          metrics={metrics}
          critical={critical}
          counts={counts}
        />
      )}
    </div>
  );
}
