"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const INTERVALS: { value: string; label: string }[] = [
  { value: "1m", label: "1 минута" },
  { value: "1h", label: "1 час" },
  { value: "1d", label: "1 день" },
];
const BODY_TYPES: { value: string; label: string }[] = [
  { value: "NONE", label: "Без тела" },
  { value: "JSON", label: "JSON" },
  { value: "XML", label: "XML" },
  { value: "FORM", label: "Form-data" },
];
const BODY_PLACEHOLDER: Record<string, string> = {
  JSON: '{\n  "key": "value"\n}',
  XML: "<request>\n  <key>value</key>\n</request>",
  FORM: "key1=value1&key2=value2",
  NONE: "",
};

type HeaderRow = { key: string; value: string };

export interface MonitorEditProps {
  id: string;
  name: string;
  url: string;
  method: string;
  interval: string;
  expectedStatus: number;
  timeoutMs: number;
  headers: string | null;
  bodyType: string;
  body: string | null;
}

function headersToRows(headers: string | null): HeaderRow[] {
  if (!headers) return [{ key: "", value: "" }];
  try {
    const obj = JSON.parse(headers) as Record<string, string>;
    const rows = Object.entries(obj).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    return rows.length > 0 ? rows : [{ key: "", value: "" }];
  } catch {
    return [{ key: "", value: "" }];
  }
}

export function MonitorEdit(props: MonitorEditProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(props.name);
  const [url, setUrl] = useState(props.url);
  const [method, setMethod] = useState<(typeof METHODS)[number]>(
    props.method as (typeof METHODS)[number],
  );
  const [interval, setInterval] = useState(props.interval);
  const [expectedStatus, setExpectedStatus] = useState(
    String(props.expectedStatus),
  );
  const [timeoutMs, setTimeoutMs] = useState(String(props.timeoutMs));
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(
    headersToRows(props.headers),
  );
  const [bodyType, setBodyType] = useState(props.bodyType);
  const [body, setBody] = useState(props.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const methodAllowsBody = method !== "GET";

  function updateHeader(i: number, field: keyof HeaderRow, val: string) {
    setHeaderRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r)),
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const headers: Record<string, string> = {};
    for (const r of headerRows) {
      if (r.key.trim()) headers[r.key.trim()] = r.value;
    }

    const res = await fetch(`/api/monitors/${props.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        url,
        method,
        interval,
        expectedStatus: Number(expectedStatus),
        timeoutMs: Number(timeoutMs),
        headers,
        bodyType: methodAllowsBody ? bodyType : "NONE",
        body: methodAllowsBody ? body : "",
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось сохранить");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  const inputCls =
    "rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand dark:border-slate-700"
      >
        Изменить
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="mb-4 font-semibold">Редактирование монитора</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <input
          required
          type="url"
          placeholder="URL для проверки"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={inputCls}
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">HTTP-метод</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])}
            className={inputCls}
          >
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Периодичность</span>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className={inputCls}
          >
            {INTERVALS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Ожидаемый код ответа</span>
          <input
            type="number"
            min={100}
            max={599}
            value={expectedStatus}
            onChange={(e) => setExpectedStatus(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Таймаут, мс</span>
          <input
            type="number"
            min={1000}
            max={60000}
            value={timeoutMs}
            onChange={(e) => setTimeoutMs(e.target.value)}
            className={inputCls}
          />
        </label>
      </div>

      {/* Заголовки */}
      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Заголовки запроса
        </div>
        <div className="space-y-2">
          {headerRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Название"
                value={row.key}
                onChange={(e) => updateHeader(i, "key", e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <input
                placeholder="Значение"
                value={row.value}
                onChange={(e) => updateHeader(i, "value", e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <button
                type="button"
                onClick={() =>
                  setHeaderRows((rows) =>
                    rows.length > 1 ? rows.filter((_, idx) => idx !== i) : rows,
                  )
                }
                className="rounded-lg border border-slate-300 px-3 text-slate-400 hover:border-red-400 hover:text-red-600 dark:border-slate-700"
                title="Удалить заголовок"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setHeaderRows((rows) => [...rows, { key: "", value: "" }])
          }
          className="mt-2 text-sm font-medium text-brand hover:underline"
        >
          + Добавить заголовок
        </button>
      </div>

      {/* Тело */}
      {methodAllowsBody && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Тело запроса
            </span>
            <select
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value)}
              className={`${inputCls} py-1 text-sm`}
            >
              {BODY_TYPES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          {bodyType !== "NONE" && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder={BODY_PLACEHOLDER[bodyType]}
              className={`${inputCls} w-full font-mono text-sm`}
            />
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
