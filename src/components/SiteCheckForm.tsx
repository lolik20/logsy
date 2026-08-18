"use client";

// Форма публичной проверки сайта: адрес → обход настоящим браузером → отчёт.
//
// Показываем ровно то, что вернул сервер: он уже вычистил из отчёта собранные со страниц
// контакты. Обход занимает до 40 секунд, поэтому кнопка блокируется и рядом идёт счётчик —
// иначе человек решит, что страница зависла, и уйдёт.

import { useEffect, useRef, useState } from "react";

type ComplianceStatus = "ok" | "warn" | "fail" | "unknown";

interface ComplianceCheck {
  id: string;
  title: string;
  status: ComplianceStatus;
  detail: string;
  law: string;
  fix: string;
  logsy: string | null;
}

interface Compliance {
  score: number;
  level: "critical" | "risky" | "ok";
  checks: ComplianceCheck[];
  summary: { fail: number; warn: number; ok: number; unknown: number };
}

interface Report {
  finalUrl: string;
  domain: string;
  statusCode: number;
  pagesCrawled: number;
  requestsTotal: number;
  durationMs: number;
  backendErrors: { url: string; status: number; kind: string; on: string; count: number }[];
  slowRequests: { url: string; ms: number; kind: string; count: number }[];
  jsErrors: { message: string; on: string; count: number }[];
  forms: { page: string; personalData: boolean; consent: string; issues: { severity: string; message: string }[] }[];
  pages: { url: string; path: string; title: string | null; status: number; ms: number; errors: number; slow: number }[];
  summary: { errors: number; slow: number; assets: number; jsErrors: number; formsChecked: number; formBugs: number; avgPageMs: number };
}

const STATUS_LABEL: Record<ComplianceStatus, string> = {
  ok: "в порядке",
  warn: "замечание",
  fail: "нарушение",
  unknown: "не проверить",
};

const STATUS_CLASS: Record<ComplianceStatus, string> = {
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  fail: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
  unknown: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

/** Время в человеческом виде: миллисекунды до секунды, дальше — секунды. */
function ms(value: number): string {
  return value < 1000 ? `${value} мс` : `${(value / 1000).toFixed(1)} с`;
}

export function SiteCheckForm() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [compliance, setCompliance] = useState<Compliance | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  // Счётчик секунд во время обхода: проверка идёт долго, без него страница выглядит мёртвой.
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const timer = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setReport(null);
    setCompliance(null);
    setLoading(true);
    try {
      const res = await fetch("/api/site-check", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось проверить сайт");
        return;
      }
      setReport(data.report as Report);
      setCompliance(data.compliance as Compliance);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("Не удалось проверить сайт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const scoreColor =
    compliance == null
      ? ""
      : compliance.level === "ok"
        ? "text-emerald-600"
        : compliance.level === "risky"
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.ru"
          required
          aria-label="Адрес сайта"
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
        >
          {loading ? `Проверяем… ${elapsed} с` : "Проверить"}
        </button>
      </form>

      {loading && (
        <p className="mt-3 text-sm text-slate-500">
          Открываем сайт настоящим браузером и обходим до шести страниц — это занимает
          до 40 секунд. Формы не отправляем.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </p>
      )}

      {report && compliance && (
        <div ref={resultRef} className="mt-8 space-y-8">
          {/* Сводка */}
          <section>
            <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800 dark:bg-slate-900/60">
              <div>
                <p className="text-sm text-slate-500">Соответствие 152-ФЗ</p>
                <p className={`mt-1 text-4xl font-bold ${scoreColor}`}>{compliance.score}/100</p>
                <p className="mt-1 text-sm text-slate-500">
                  {compliance.summary.fail} нарушений · {compliance.summary.warn} замечаний ·{" "}
                  {compliance.summary.ok} в порядке
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
                {[
                  ["Страниц обошли", String(report.pagesCrawled)],
                  ["Ошибок", String(report.summary.errors)],
                  ["Медленных", String(report.summary.slow)],
                  ["Средняя загрузка", ms(report.summary.avgPageMs)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-slate-500">{label}</dt>
                    <dd className="font-semibold text-slate-800 dark:text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          {/* Проверки 152-ФЗ */}
          <section>
            <h2 className="text-xl font-semibold">Проверка по 152-ФЗ</h2>
            <p className="mt-1 text-sm text-slate-500">
              Техническая проверка того, что видно снаружи. Это не юридическое заключение.
            </p>
            <div className="mt-4 space-y-3">
              {compliance.checks.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                    <h3 className="font-semibold">{c.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{c.detail}</p>
                  {c.status !== "ok" && (
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-medium">Что сделать: </span>
                      {c.fix}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">{c.law}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Технические находки */}
          {(report.backendErrors.length > 0 || report.slowRequests.length > 0 || report.jsErrors.length > 0) && (
            <section>
              <h2 className="text-xl font-semibold">Что нашли на страницах</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {report.backendErrors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <h3 className="font-semibold">Ошибки запросов</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {report.backendErrors.slice(0, 8).map((e) => (
                        <li key={e.url} className="break-all text-slate-600 dark:text-slate-300">
                          <span className="font-mono text-red-600">{e.status || "сбой"}</span> {e.url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.slowRequests.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <h3 className="font-semibold">Медленные запросы</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {report.slowRequests.slice(0, 8).map((s) => (
                        <li key={s.url} className="break-all text-slate-600 dark:text-slate-300">
                          <span className="font-mono text-amber-600">{ms(s.ms)}</span> {s.url}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.jsErrors.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <h3 className="font-semibold">Ошибки JavaScript</h3>
                    <ul className="mt-2 space-y-1.5 text-sm">
                      {report.jsErrors.slice(0, 6).map((e) => (
                        <li key={e.message} className="break-words text-slate-600 dark:text-slate-300">
                          {e.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.summary.formsChecked > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                    <h3 className="font-semibold">Формы</h3>
                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Проверено {report.summary.formsChecked}, замечаний — {report.summary.formBugs}.
                      Формы не отправлялись.
                    </p>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                      {report.forms
                        .flatMap((f) => f.issues.map((i) => `${i.message} — ${f.page}`))
                        .slice(0, 5)
                        .map((line) => (
                          <li key={line} className="break-all">
                            {line}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Карта обойдённых страниц */}
          <section>
            <h2 className="text-xl font-semibold">Обойдённые страницы</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Страница</th>
                    <th className="px-4 py-2 font-medium">Код</th>
                    <th className="px-4 py-2 font-medium">Загрузка</th>
                    <th className="px-4 py-2 font-medium">Проблем</th>
                  </tr>
                </thead>
                <tbody>
                  {report.pages.map((p) => (
                    <tr key={p.url} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="max-w-[280px] truncate px-4 py-2 text-slate-700 dark:text-slate-200" title={p.title ?? p.path}>
                        {p.path}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{p.status}</td>
                      <td className="px-4 py-2 font-mono text-xs">{ms(p.ms)}</td>
                      <td className="px-4 py-2">{p.errors + p.slow}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
