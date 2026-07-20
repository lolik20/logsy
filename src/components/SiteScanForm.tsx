"use client";

// Форма админ-инструмента «Обход»: поле с адресом сайта + кнопка «Запуск». По сабмиту
// шлёт URL на /api/admin/scan, бот обходит сайт и возвращает отчёт (ошибки бэкенда,
// медленные запросы, статика, найденные почты и телефоны). Отчёт рендерится карточками
// прямо под формой. Компонент самодостаточен — тот же отчёт позже переиспользуется на
// отдельной странице лендинга.

import { useState } from "react";

type AssetKind = "script" | "style" | "image" | "font" | "other";
type RequestKind = "page" | "script" | "style" | "image" | "font" | "xhr" | "other";

interface ScanError {
  url: string;
  status: number;
  kind: "server" | "client" | "network";
  on: string;
}
interface ScanSlow {
  url: string;
  ms: number;
  kind: RequestKind;
}
interface ScanAsset {
  url: string;
  kind: AssetKind;
  status: number;
  ms: number;
  bytes: number;
}
interface ScanReport {
  startUrl: string;
  finalUrl: string;
  domain: string;
  statusCode: number;
  pagesCrawled: number;
  requestsTotal: number;
  transferBytes: number;
  durationMs: number;
  stopped: "done" | "pages" | "resources" | "budget";
  backendErrors: ScanError[];
  slowRequests: ScanSlow[];
  staticAssets: ScanAsset[];
  emails: string[];
  phones: string[];
  summary: {
    errors: number;
    slow: number;
    assets: number;
    emails: number;
    phones: number;
    avgPageMs: number;
  };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} Б`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} КБ`;
  return `${(b / 1024 / 1024).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

const KIND_LABEL: Record<AssetKind, string> = {
  script: "Скрипт",
  style: "Стиль",
  image: "Картинка",
  font: "Шрифт",
  other: "Файл",
};

/** Человеко-читаемый тип запроса для списка медленных. */
function reqKindLabel(kind: RequestKind): string {
  if (kind === "page") return "страница";
  if (kind === "xhr") return "запрос (XHR)";
  return KIND_LABEL[kind];
}

const STOP_NOTE: Record<ScanReport["stopped"], string | null> = {
  done: null,
  pages: "Достигнут лимит страниц обхода — показаны первые найденные.",
  resources: "Достигнут лимит числа ресурсов — проверены не все файлы.",
  budget: "Обход остановлен по времени — сайт большой, показана часть.",
};

/** Короткий вид URL: без схемы, обрезка длинного хвоста. */
function shortUrl(u: string): string {
  const s = u.replace(/^https?:\/\//, "");
  return s.length > 80 ? s.slice(0, 78) + "…" : s;
}

function Tile({ value, label, tone }: { value: number | string; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-center dark:border-slate-800 dark:bg-slate-900">
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-1 text-[11px] leading-tight text-slate-500">{label}</div>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-900/70">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800">
          {count}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function SiteScanForm() {
  const [url, setUrl] = useState("");
  const [report, setReport] = useState<ScanReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setReport(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось обойти сайт");
        return;
      }
      setReport(data as ScanReport);
    } catch {
      setError("Не удалось обойти сайт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const r = report;
  const stopNote = r ? STOP_NOTE[r.stopped] : null;

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          required
          placeholder="example.ru"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
          className="w-full flex-1 rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-base outline-none focus:border-brand disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "Обходим сайт…" : "Запуск"}
        </button>
      </form>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">
          Бот обходит сайт по внутренним ссылкам и проверяет запросы — это может занять до
          минуты.
        </p>
      )}

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {r && (
        <div className="mt-6 space-y-5">
          {/* Шапка отчёта */}
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm text-slate-600 dark:text-slate-300">
                  {r.finalUrl}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  Обошли {r.pagesCrawled} стр. · {r.requestsTotal} запросов ·{" "}
                  {formatBytes(r.transferBytes)} · за {formatMs(r.durationMs)} · среднее время
                  страницы {formatMs(r.summary.avgPageMs)}
                </div>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                  r.statusCode >= 200 && r.statusCode < 400
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                }`}
              >
                HTTP {r.statusCode || "—"}
              </span>
            </div>
            {stopNote && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                {stopNote}
              </p>
            )}
          </div>

          {/* Сводка */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Tile
              value={r.summary.errors}
              label="Ошибок"
              tone={r.summary.errors ? "text-red-600 dark:text-red-400" : "text-slate-400"}
            />
            <Tile
              value={r.summary.slow}
              label="Медленных"
              tone={r.summary.slow ? "text-amber-600 dark:text-amber-400" : "text-slate-400"}
            />
            <Tile value={r.summary.assets} label="Статики" tone="text-slate-700 dark:text-slate-200" />
            <Tile value={r.summary.emails} label="Почт" tone="text-brand" />
            <Tile value={r.summary.phones} label="Телефонов" tone="text-brand" />
          </div>

          {/* Ошибки бэкенда */}
          {r.backendErrors.length > 0 && (
            <Section title="Ошибки бэкенда и упавшие запросы" count={r.summary.errors}>
              <ul className="space-y-1.5">
                {r.backendErrors.map((e, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
                        e.kind === "server"
                          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                          : e.kind === "network"
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      }`}
                    >
                      {e.status === 0 ? "нет ответа" : e.status}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                      {shortUrl(e.url)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Медленные запросы */}
          {r.slowRequests.length > 0 && (
            <Section title="Медленные запросы (> 1 с)" count={r.summary.slow}>
              <ul className="space-y-1.5">
                {r.slowRequests.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      {formatMs(s.ms)}
                    </span>
                    <span className="shrink-0 text-[11px] text-slate-400">
                      {reqKindLabel(s.kind)}
                    </span>
                    <span className="min-w-0 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                      {shortUrl(s.url)}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Почты */}
          {r.emails.length > 0 && (
            <Section title="Найденные почты" count={r.summary.emails}>
              <div className="flex flex-wrap gap-2">
                {r.emails.map((m) => (
                  <a
                    key={m}
                    href={`mailto:${m}`}
                    className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:underline dark:bg-brand/15"
                  >
                    {m}
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Телефоны */}
          {r.phones.length > 0 && (
            <Section title="Найденные телефоны" count={r.summary.phones}>
              <div className="flex flex-wrap gap-2">
                {r.phones.map((p) => (
                  <a
                    key={p}
                    href={`tel:${p}`}
                    className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:underline dark:bg-brand/15"
                  >
                    {p}
                  </a>
                ))}
              </div>
            </Section>
          )}

          {/* Статика */}
          {r.staticAssets.length > 0 && (
            <Section title="Статика (скрипты, стили, картинки, шрифты)" count={r.summary.assets}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-400">
                    <tr>
                      <th className="pb-2 pr-2 font-medium">Тип</th>
                      <th className="pb-2 pr-2 font-medium">Файл</th>
                      <th className="pb-2 pr-2 font-medium">Размер</th>
                      <th className="pb-2 pr-2 font-medium">Время</th>
                      <th className="pb-2 font-medium">Код</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.staticAssets.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-1.5 pr-2 text-xs text-slate-500">{KIND_LABEL[a.kind]}</td>
                        <td className="max-w-[16rem] truncate py-1.5 pr-2 font-mono text-xs text-slate-600 dark:text-slate-300">
                          {shortUrl(a.url)}
                        </td>
                        <td className="py-1.5 pr-2 text-xs text-slate-500">
                          {formatBytes(a.bytes)}
                        </td>
                        <td
                          className={`py-1.5 pr-2 text-xs font-medium ${
                            a.ms >= 1000 ? "text-amber-600 dark:text-amber-400" : "text-slate-500"
                          }`}
                        >
                          {formatMs(a.ms)}
                        </td>
                        <td className="py-1.5 text-xs">
                          <span
                            className={
                              a.status === 0 || a.status >= 400
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500"
                            }
                          >
                            {a.status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          {r.summary.errors === 0 && r.summary.slow === 0 && (
            <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              Ошибок бэкенда и медленных запросов при обходе не найдено.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
