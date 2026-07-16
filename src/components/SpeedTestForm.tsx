"use client";

import Link from "next/link";
import { useState } from "react";

interface SpeedResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number | null;
  requests: number;
  transferBytes: number;
  redirected: boolean;
}

interface Grade {
  label: string;
  cls: string;
  bar: string;
  w: string;
  /** Провокационный вердикт под результатом — давит на боль клиента. */
  verdict: string;
  /** Оценка потерь / упущенной выгоды. */
  pain: string;
}

/** Оценка по времени готовности DOM (со скриптами) + вердикт для конверсии. */
function grade(domMs: number): Grade {
  if (domMs < 1000)
    return {
      label: "Быстро",
      cls: "text-emerald-600",
      bar: "bg-emerald-500",
      w: "22%",
      verdict: "Сейчас быстро. Но вы видите только одну страницу и один момент.",
      pain: "А остальные разделы? А ночью, под нагрузкой, когда упадёт оплата — кто вам скажет?",
    };
  if (domMs < 2500)
    return {
      label: "Терпимо",
      cls: "text-amber-600",
      bar: "bg-amber-500",
      w: "50%",
      verdict: "Уже не быстро. Каждая лишняя секунда — это уходящие клиенты.",
      pain: "Google понижает медленные сайты в выдаче, а посетители закрывают вкладку, не дождавшись.",
    };
  if (domMs < 5000)
    return {
      label: "Медленно",
      cls: "text-orange-600",
      bar: "bg-orange-500",
      w: "78%",
      verdict: "Это медленно. Больше половины посетителей уходят, не дождавшись загрузки.",
      pain: "Вы платите за рекламу и трафик — и теряете его на первой же секунде ожидания.",
    };
  return {
    label: "Критично",
    cls: "text-red-600",
    bar: "bg-red-500",
    w: "100%",
    verdict: "Так долго ждать никто не будет. Вы теряете клиентов прямо сейчас.",
    pain: "Каждый второй уйдёт к конкуренту. Найдите, что именно тормозит, пока не потеряли ещё больше.",
  };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

export function SpeedTestForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/speed-test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось проверить сайт");
        return;
      }
      setResult(data as SpeedResult);
    } catch {
      setError("Не удалось проверить сайт. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  const g = result ? grade(result.domContentLoadedMs) : null;

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
          className="w-full flex-1 rounded-xl border border-slate-300 bg-white/80 px-4 py-3 text-base outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-900/60"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60"
        >
          {loading ? "Проверяем…" : "Проверить скорость"}
        </button>
      </form>

      {error && (
        <div className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {result && g && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/60 bg-white/80 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/70">
          {/* Заголовок карточки результата */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 dark:border-slate-700/70">
            <span className="min-w-0 truncate font-mono text-sm text-slate-500">
              {result.finalUrl}
            </span>
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                result.statusCode >= 200 && result.statusCode < 400
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"
              }`}
            >
              HTTP {result.statusCode}
            </span>
          </div>

          {/* Итоговая оценка — время готовности DOM со скриптами */}
          <div className="px-5 pt-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-slate-500">Загрузка DOM (со скриптами)</span>
              <span className={`text-2xl font-extrabold ${g.cls}`}>{g.label}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold">
                {formatMs(result.domContentLoadedMs)}
              </span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <span className={`block h-full rounded-full ${g.bar}`} style={{ width: g.w }} />
            </div>
          </div>

          {/* Метрики */}
          <div className="grid grid-cols-4 gap-px bg-slate-200/70 p-5 dark:bg-slate-700/50">
            {[
              { label: "Первый байт (TTFB)", value: formatMs(result.ttfbMs) },
              { label: "DOM готов", value: formatMs(result.domContentLoadedMs) },
              {
                label: "Полная загрузка",
                value: result.loadMs != null ? formatMs(result.loadMs) : "—",
              },
              { label: "Запросов", value: String(result.requests) },
            ].map((m) => (
              <div
                key={m.label}
                className="bg-white px-2 py-3 text-center dark:bg-slate-900"
              >
                <div className="text-base font-bold sm:text-lg">{m.value}</div>
                <div className="mt-1 text-[11px] leading-tight text-slate-500">
                  {m.label}
                </div>
              </div>
            ))}
          </div>

          {result.redirected && (
            <p className="px-5 pt-3 text-xs text-slate-400">
              Запрос прошёл через переадресацию до конечного адреса.
            </p>
          )}

          {/* Провокационный вердикт — давим на боль по результату */}
          <div
            className={`m-5 rounded-xl border-l-4 p-4 ${
              result.domContentLoadedMs < 1000
                ? "border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/20"
                : result.domContentLoadedMs < 2500
                  ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/20"
                  : "border-red-500 bg-red-50/70 dark:bg-red-950/20"
            }`}
          >
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {g.verdict}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{g.pain}</p>
          </div>
        </div>
      )}

      {/* CTA — подробный отчёт. Заголовок меняется, если сайт оказался медленным. */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand to-indigo-500 p-[1.5px] shadow-card">
        <div className="rounded-[calc(1rem-1.5px)] bg-white/90 px-6 py-7 backdrop-blur-xl dark:bg-slate-900/90 sm:px-8">
          <div className="text-center">
            <span className="inline-block rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950/40 dark:text-red-400">
              Это только вершина айсберга
            </span>
            <h3 className="mt-3 text-2xl font-extrabold sm:text-3xl">
              {result && result.domContentLoadedMs >= 2500
                ? "Хотите узнать, что именно тормозит ваш сайт?"
                : "Одна цифра не покажет, где вы теряете клиентов"}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
              Эта проверка измерила одну страницу. Logsy обойдёт{" "}
              <b>весь сайт</b>, найдёт медленные страницы, тяжёлые файлы, ошибки
              и упавшие запросы — и покажет на карте, где именно уходят
              посетители.
            </p>
          </div>

          {/* Что найдёт подробный отчёт */}
          <ul className="mx-auto mt-6 grid max-w-lg gap-2.5 text-sm sm:grid-cols-2">
            {[
              "Медленные страницы по всему сайту",
              "Тяжёлые файлы и картинки, что тормозят загрузку",
              "Ошибки 4xx / 5xx и упавшие запросы",
              "Карта загрузки — где именно уходят клиенты",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-0.5 text-brand">✓</span>
                <span className="text-slate-600 dark:text-slate-300">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 text-center">
            <Link
              href="/register"
              className="inline-block rounded-xl bg-gradient-to-r from-brand to-indigo-500 px-8 py-3.5 text-lg font-bold text-white shadow-card transition-transform hover:-translate-y-0.5"
            >
              Найти ошибки и ускорить сайт — бесплатно
            </Link>
            <p className="mt-3 text-xs text-slate-400">
              Регистрация за минуту · без карты · навсегда бесплатный тариф
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
