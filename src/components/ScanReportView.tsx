"use client";

// Презентационный вид отчёта об обходе сайта. Используется и на живой странице «Обход»
// (после запуска), и на странице просмотра сохранённого отчёта из истории. Данные —
// сериализуемый объект ScanReport, поэтому компонент работает и как клиентский остров
// внутри серверной страницы.

import { useState } from "react";
import { OutreachPanel } from "@/components/OutreachPanel";

type AssetKind = "script" | "style" | "image" | "font" | "other";
type RequestKind = "page" | "script" | "style" | "image" | "font" | "xhr" | "other";

interface ScanError {
  url: string;
  status: number;
  kind: "server" | "client" | "network";
  on: string;
  count: number;
}
interface ScanSlow {
  url: string;
  ms: number;
  kind: RequestKind;
  count: number;
}
interface ScanAsset {
  url: string;
  kind: AssetKind;
  status: number;
  ms: number;
  bytes: number;
}
interface ScanPageIssue {
  url: string;
  type: "error" | "slow";
  status: number;
  ms: number;
  kind: RequestKind;
  errorKind: "server" | "client" | "network" | null;
  count: number;
}
interface ScanPage {
  url: string;
  path: string;
  title: string | null;
  depth: number;
  status: number;
  ms: number;
  errors: number;
  slow: number;
  issues: ScanPageIssue[];
}
export interface ScanReport {
  startUrl: string;
  finalUrl: string;
  domain: string;
  statusCode: number;
  pagesCrawled: number;
  requestsTotal: number;
  transferBytes: number;
  durationMs: number;
  stopped: "done" | "pages" | "requests" | "budget";
  pages: ScanPage[];
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

function reqKindLabel(kind: RequestKind): string {
  if (kind === "page") return "страница";
  if (kind === "xhr") return "запрос";
  return KIND_LABEL[kind];
}

/** Короткий вид URL: без схемы, обрезка длинного хвоста. */
function shortUrl(u: string): string {
  const s = u.replace(/^https?:\/\//, "");
  return s.length > 80 ? s.slice(0, 78) + "…" : s;
}

/** Бейдж «×N», если запрос повторялся. */
function RepeatBadge({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      ×{count}
    </span>
  );
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

const STOP_NOTE: Record<ScanReport["stopped"], string | null> = {
  done: null,
  pages: "Достигнут лимит страниц обхода — показаны первые найденные.",
  requests: "Достигнут лимит числа запросов — проверены не все.",
  budget: "Обход остановлен по времени — сайт большой, показана часть.",
};

/** Один критический момент (ошибка или медленный запрос) внутри страницы. */
function PageIssueRow({ issue }: { issue: ScanPageIssue }) {
  const isError = issue.type === "error";
  const badge = isError
    ? issue.status === 0
      ? "нет ответа"
      : String(issue.status)
    : formatMs(issue.ms);
  const badgeCls = isError
    ? issue.errorKind === "server"
      ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
      : issue.errorKind === "network"
        ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${badgeCls}`}>
        {badge}
      </span>
      <span className="shrink-0 text-[11px] text-slate-400">{reqKindLabel(issue.kind)}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
        {shortUrl(issue.url)}
      </span>
      <RepeatBadge count={issue.count} />
    </li>
  );
}

/** Карточка страницы в карте сайта: заголовок + сворачиваемые критические моменты. */
function PageCard({ page }: { page: ScanPage }) {
  const hasIssues = page.issues.length > 0;
  const [open, setOpen] = useState(hasIssues);
  const okStatus = page.status >= 200 && page.status < 400;
  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-800"
      style={{ marginLeft: `${Math.min(page.depth, 4) * 14}px` }}
    >
      <button
        type="button"
        onClick={() => hasIssues && setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left ${hasIssues ? "cursor-pointer" : "cursor-default"}`}
      >
        {hasIssues ? (
          <svg
            viewBox="0 0 24 24"
            className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        ) : (
          <span className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {page.path}
          </span>
          {page.title && (
            <span className="block truncate text-[11px] text-slate-400">{page.title}</span>
          )}
        </span>
        <span className="shrink-0 text-[11px] text-slate-400">{formatMs(page.ms)}</span>
        {page.errors > 0 && (
          <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {page.errors} ош.
          </span>
        )}
        {page.slow > 0 && (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {page.slow} медл.
          </span>
        )}
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            okStatus
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
          }`}
        >
          {page.status || "—"}
        </span>
      </button>
      {open && hasIssues && (
        <ul className="space-y-1.5 border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
          {page.issues.map((iss, i) => (
            <PageIssueRow key={i} issue={iss} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function ScanReportView({ report: r, scanId }: { report: ScanReport; scanId?: string }) {
  const stopNote = STOP_NOTE[r.stopped];

  // Почты и телефоны держим в состоянии — их можно удалить из отчёта (если известен scanId).
  const [emails, setEmails] = useState<string[]>(r.emails);
  const [phones, setPhones] = useState<string[]>(r.phones);

  async function deleteContact(type: "email" | "phone", value: string) {
    // Оптимистично убираем из списка; при ошибке возвращаем.
    const prevEmails = emails;
    const prevPhones = phones;
    if (type === "email") setEmails((l) => l.filter((v) => v !== value));
    else setPhones((l) => l.filter((v) => v !== value));
    if (!scanId) return;
    try {
      const res = await fetch(`/api/admin/scan/${scanId}/contacts`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, value }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setEmails(prevEmails);
      setPhones(prevPhones);
    }
  }
  return (
    <div className="space-y-5">
      {/* Панель действий */}
      {scanId && (
        <div className="flex justify-end">
          <a
            href={`/api/admin/scan/${scanId}/pdf`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-card transition-colors hover:border-brand hover:text-brand dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" />
              <path d="m7 10 5 5 5-5" />
              <path d="M5 21h14" />
            </svg>
            Скачать отчёт (PDF)
          </a>
        </div>
      )}

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
        <Tile value={emails.length} label="Почт" tone="text-brand" />
        <Tile value={phones.length} label="Телефонов" tone="text-brand" />
      </div>

      {/* Карта сайта с критическими моментами на каждой странице */}
      {r.pages.length > 0 && (
        <Section title="Карта сайта — критические моменты по страницам" count={r.pages.length}>
          <div className="space-y-1.5">
            {r.pages.map((p, i) => (
              <PageCard key={i} page={p} />
            ))}
          </div>
        </Section>
      )}

      {/* Ошибки на сайте */}
      {r.backendErrors.length > 0 && (
        <Section title="Ошибки на сайте" count={r.summary.errors}>
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
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                  {shortUrl(e.url)}
                </span>
                <RepeatBadge count={e.count} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Медленные запросы */}
      {r.slowRequests.length > 0 && (
        <Section title="Медленные загрузки (дольше 2 секунд)" count={r.summary.slow}>
          <ul className="space-y-1.5">
            {r.slowRequests.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {formatMs(s.ms)}
                </span>
                <span className="shrink-0 text-[11px] text-slate-400">{reqKindLabel(s.kind)}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600 dark:text-slate-300">
                  {shortUrl(s.url)}
                </span>
                <RepeatBadge count={s.count} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Почты + рассылка */}
      {emails.length > 0 && (
        <Section title="Найденные почты и рассылка" count={emails.length}>
          {scanId ? (
            <OutreachPanel
              scanId={scanId}
              emails={emails}
              onDelete={(m) => deleteContact("email", m)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {emails.map((m) => (
                <a
                  key={m}
                  href={`mailto:${m}`}
                  className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand hover:underline dark:bg-brand/15"
                >
                  {m}
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Телефоны */}
      {phones.length > 0 && (
        <Section title="Найденные телефоны" count={phones.length}>
          <div className="flex flex-wrap gap-2">
            {phones.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium dark:bg-brand/15"
              >
                <a href={`tel:${p}`} className="text-brand hover:underline">
                  {p}
                </a>
                <button
                  type="button"
                  onClick={() => deleteContact("phone", p)}
                  aria-label={`Удалить ${p}`}
                  title="Удалить контакт"
                  className="text-slate-400 transition-colors hover:text-red-600"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </span>
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
                    <td className="py-1.5 pr-2 text-xs text-slate-500">{formatBytes(a.bytes)}</td>
                    <td
                      className={`py-1.5 pr-2 text-xs font-medium ${
                        a.ms >= 2000 ? "text-amber-600 dark:text-amber-400" : "text-slate-500"
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
          Ошибок на сайте и медленных загрузок не найдено.
        </div>
      )}
    </div>
  );
}
