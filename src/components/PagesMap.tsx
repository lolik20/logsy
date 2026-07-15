"use client";

import { useMemo, useState } from "react";
import type { PageNode, PageLoadMetric, CriticalRequest } from "@/lib/pages";

// Пороги «карты загрузки» (мс) для цвета индикатора среднего времени до прогрузки контента.
const LOAD_OK = 1500; // быстро — зелёный
const LOAD_WARN = 3000; // средне — янтарный; выше — красный

/** Форматирует длительность: «850 мс» или «1,8 с». */
function fmtMs(ms: number): string {
  if (ms >= 1000) return (ms / 1000).toFixed(1).replace(".", ",") + " с";
  return Math.round(ms) + " мс";
}

/** Цветовые классы индикатора по среднему времени загрузки. */
function loadTone(ms: number): { bar: string; text: string } {
  if (ms <= LOAD_OK) return { bar: "bg-emerald-500", text: "text-emerald-600" };
  if (ms <= LOAD_WARN) return { bar: "bg-amber-500", text: "text-amber-600" };
  return { bar: "bg-red-500", text: "text-red-600" };
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Список критических запросов/файлов конкретной страницы. */
function CriticalList({ items }: { items: CriticalRequest[] }) {
  if (!items.length) {
    return (
      <p className="px-3 py-2 text-xs text-slate-400">
        Медленных запросов и файлов на этой странице не зафиксировано.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {items.map((it) => {
        const tone = loadTone(it.maxMs);
        const isResource = it.kind === "RESOURCE";
        return (
          <li
            key={it.route}
            className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
          >
            <div className="flex min-w-0 items-start gap-2">
              <span
                className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                  isResource
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300"
                    : "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                }`}
                title={isResource ? "Статический файл" : "Сетевой запрос"}
              >
                {it.initiator || (isResource ? "файл" : "запрос")}
              </span>
              <span className="min-w-0">
                {/* Полный URL запроса с query-параметрами (переносится, не обрезается). */}
                <span className="block break-all font-mono text-xs text-slate-700 dark:text-slate-200">
                  {it.route}
                </span>
                {it.count > 1 && (
                  <span className="text-[11px] text-slate-400">
                    {it.count} раз · в среднем {fmtMs(it.avgMs)}
                  </span>
                )}
              </span>
            </div>
            <span className={`mt-0.5 shrink-0 text-sm font-semibold ${tone.text}`}>{fmtMs(it.maxMs)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Один узел дерева (страница/каталог) с индикатором загрузки и разворачиваемой панелью. */
function TreeRow({
  node,
  depth,
  domain,
  metrics,
  critical,
  scaleMax,
  open,
  toggle,
}: {
  node: PageNode;
  depth: number;
  domain: string;
  metrics: Record<string, PageLoadMetric>;
  critical: Record<string, CriticalRequest[]>;
  scaleMax: number;
  open: Set<string>;
  toggle: (path: string) => void;
}) {
  const metric = metrics[node.path];
  const crit = critical[node.path];
  const hasChildren = node.children.length > 0;
  // Разворачивается, если есть дети или есть что показать в панели (метрики/критичные).
  const expandable = hasChildren || node.isPage;
  const isOpen = open.has(node.path);

  const label =
    node.path === "/" ? domain : node.segment;
  const tone = metric ? loadTone(metric.avgLoadMs) : null;
  const barPct = metric ? Math.max(4, Math.min(100, (metric.avgLoadMs / scaleMax) * 100)) : 0;

  return (
    <div>
      <div
        role={expandable ? "button" : undefined}
        tabIndex={expandable ? 0 : undefined}
        onClick={() => expandable && toggle(node.path)}
        onKeyDown={(e) => {
          if (expandable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            toggle(node.path);
          }
        }}
        className={`flex items-center gap-2 rounded-lg py-2 pr-3 ${
          expandable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" : ""
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="w-4 shrink-0">{expandable ? <ChevronIcon open={isOpen} /> : null}</span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100" title={node.path}>
              {label}
            </span>
            {!node.isPage && (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                каталог
              </span>
            )}
            {node.source === "SESSION" && (
              <span
                className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800"
                title="Замечена в сессиях, но не найдена краулером"
              >
                из сессий
              </span>
            )}
          </span>
          {node.title && node.title !== label && (
            <span className="block truncate text-xs text-slate-400" title={node.title}>
              {node.title}
            </span>
          )}
        </span>

        {/* Индикатор карты загрузки — среднее время до прогрузки контента. */}
        {metric && tone ? (
          <span className="flex shrink-0 items-center gap-2">
            <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
              <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${barPct}%` }} />
            </span>
            <span className={`w-16 text-right text-sm font-semibold ${tone.text}`}>
              {fmtMs(metric.avgLoadMs)}
            </span>
          </span>
        ) : (
          <span className="w-16 shrink-0 text-right text-xs text-slate-300 dark:text-slate-600">—</span>
        )}
      </div>

      {isOpen && (
        <div>
          {/* Панель критических запросов страницы. */}
          {node.isPage && (
            <div className="ml-4 mb-2 mr-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900" style={{ marginLeft: `${depth * 16 + 28}px` }}>
              <div className="flex items-center justify-between px-1 pb-1.5">
                <span className="text-xs font-semibold text-slate-500">
                  Критические запросы и файлы (&gt; 1 с)
                </span>
                {metric && (
                  <span className="text-[11px] text-slate-400">
                    замеров загрузки: {metric.samples} · макс {fmtMs(metric.maxLoadMs)}
                  </span>
                )}
              </div>
              <CriticalList items={crit ?? []} />
            </div>
          )}

          {/* Дочерние каталоги/страницы. */}
          {node.children.map((child) => (
            <TreeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              domain={domain}
              metrics={metrics}
              critical={critical}
              scaleMax={scaleMax}
              open={open}
              toggle={toggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PagesMap({
  domain,
  tree,
  metrics,
  critical,
}: {
  domain: string;
  tree: PageNode[];
  metrics: Record<string, PageLoadMetric>;
  critical: Record<string, CriticalRequest[]>;
}) {
  // По умолчанию раскрываем корень, чтобы карта не выглядела пустой.
  const [open, setOpen] = useState<Set<string>>(() => new Set(tree.map((n) => n.path)));

  const toggle = (path: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  // Сводка и масштаб шкалы карты загрузки.
  const { scaleMax, overallAvg, measured, slowPages } = useMemo(() => {
    const vals = Object.values(metrics);
    const max = vals.reduce((m, v) => Math.max(m, v.avgLoadMs), 0);
    const sum = vals.reduce((s, v) => s + v.avgLoadMs, 0);
    return {
      scaleMax: Math.max(2000, max),
      overallAvg: vals.length ? Math.round(sum / vals.length) : 0,
      measured: vals.length,
      slowPages: vals.filter((v) => v.avgLoadMs > LOAD_WARN).length,
    };
  }, [metrics]);

  return (
    <div>
      {measured > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="text-lg font-bold">{fmtMs(overallAvg)}</div>
            <div className="text-xs text-slate-400">среднее время загрузки</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="text-lg font-bold">{measured}</div>
            <div className="text-xs text-slate-400">страниц с замерами</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className={`text-lg font-bold ${slowPages > 0 ? "text-red-600" : ""}`}>{slowPages}</div>
            <div className="text-xs text-slate-400">медленных страниц</div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">
        {tree.map((node) => (
          <TreeRow
            key={node.path}
            node={node}
            depth={0}
            domain={domain}
            metrics={metrics}
            critical={critical}
            scaleMax={scaleMax}
            open={open}
            toggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}
