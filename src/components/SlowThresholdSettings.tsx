"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Быстрые пресеты порога (мс).
const PRESETS = [500, 1000, 2000, 3000];
const MIN_MS = 0;
const MAX_MS = 60000;

/**
 * Настройка порога «медленного» запроса из панели. SDK читает значение через
 * /api/logger/config и считает медленными запросы/статические файлы дольше него.
 * Значение сохраняется в проект (Project.slowMs) через PATCH /api/projects/[id].
 */
export function SlowThresholdSettings({
  projectId,
  slowMs: initial,
}: {
  projectId: string;
  slowMs: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState<string>(String(initial));
  const [saved, setSaved] = useState<number>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= MIN_MS && parsed <= MAX_MS;
  const dirty = valid && parsed !== saved;

  async function save() {
    if (!valid) {
      setError(`Введите число от ${MIN_MS} до ${MAX_MS} мс`);
      return;
    }
    setError(null);
    setOk(false);
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slowMs: parsed }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Не удалось сохранить");
      return;
    }
    setSaved(parsed);
    setOk(true);
    router.refresh();
  }

  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        Порог медленного запроса
      </h3>
      <p className="mt-1 text-xs text-slate-400">
        Запросы и статические файлы (скрипты, стили, картинки, шрифты), которые грузятся
        дольше этого порога, попадают в логи и на карту загрузки как медленные. Значение
        применяется ко всем страницам сайта. Атрибут{" "}
        <code className="font-mono">data-slow-ms</code> на теге скрипта, если задан,
        переопределяет порог на конкретной странице.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
          <input
            type="number"
            inputMode="numeric"
            min={MIN_MS}
            max={MAX_MS}
            step={100}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOk(false);
              setError(null);
            }}
            className="w-28 bg-transparent px-3 py-1.5 text-sm outline-none"
          />
          <span className="border-l border-slate-300 px-2 py-1.5 text-xs text-slate-400 dark:border-slate-700">
            мс
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setValue(String(p));
                setOk(false);
                setError(null);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                parsed === p
                  ? "bg-brand-50 text-brand dark:bg-brand/15"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={loading || !dirty}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-light disabled:opacity-60"
        >
          {loading ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {ok && !error && <p className="mt-2 text-xs text-emerald-600">Порог сохранён: {saved} мс</p>}
    </div>
  );
}
