"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Faq } from "@/components/Faq";

const MONITOR_FAQ = [
  {
    q: "Что указать в поле «URL запроса»?",
    a: "Хост берётся из домена сайта — вам нужно ввести только путь, например /health или /api/status. Для проверки главной страницы оставьте /.",
  },
  {
    q: "Какой HTTP-метод выбрать?",
    a: "Для обычной проверки доступности подойдёт GET. POST/PUT/DELETE нужны, если эндпоинт ждёт запрос с телом — тогда появится поле для тела запроса.",
  },
  {
    q: "Что такое периодичность и ожидаемый код?",
    a: "Периодичность — как часто мы опрашиваем адрес. Ожидаемый код — HTTP-статус, который считается «всё хорошо» (обычно 200). Если ответ другой — монитор пометится как упавший.",
  },
  {
    q: "Зачем заголовки и порт?",
    a: "Заголовки нужны для защищённых эндпоинтов (например Authorization). Порт указывайте, только если сервис слушает нестандартный порт — иначе используется 80/443.",
  },
];

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

// Собирает полный URL из домена проекта и пути, введённого пользователем.
// Если пользователь ввёл полный URL (со схемой) — берём как есть.
export function composeUrl(domain: string, input: string): string {
  const v = input.trim();
  if (/^https?:\/\//i.test(v)) return v;
  const path = v === "" ? "" : v.startsWith("/") ? v : "/" + v;
  return `https://${domain}${path}`;
}

export function MonitorManager({
  projectId,
  projectDomain,
}: {
  projectId: string;
  projectDomain: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("/");
  const [port, setPort] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("GET");
  const [interval, setInterval] = useState("1m");
  const [expectedStatus, setExpectedStatus] = useState("200");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([
    { key: "", value: "" },
  ]);
  const [bodyType, setBodyType] = useState("NONE");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const methodAllowsBody = method !== "GET";

  function reset() {
    setName("");
    setPath("/");
    setPort("");
    setMethod("GET");
    setInterval("1m");
    setExpectedStatus("200");
    setHeaderRows([{ key: "", value: "" }]);
    setBodyType("NONE");
    setBody("");
  }

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

    const res = await fetch("/api/monitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        name,
        url: composeUrl(projectDomain, path),
        port: port.trim() === "" ? null : Number(port),
        method,
        interval,
        expectedStatus: Number(expectedStatus),
        headers,
        bodyType: methodAllowsBody ? bodyType : "NONE",
        body: methodAllowsBody ? body : "",
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось создать монитор");
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
      >
        + Добавить монитор
      </button>
    );
  }

  const inputCls =
    "rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="mb-4 font-semibold">Новый монитор</h3>
      <Faq items={MONITOR_FAQ} className="mb-4" title="Как заполнить форму" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Название (напр. Главная страница)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <label className="flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="text-slate-500">URL запроса</span>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand dark:border-slate-700">
            <span className="flex items-center whitespace-nowrap bg-slate-100 px-3 text-sm text-slate-500 dark:bg-slate-800">
              https://{projectDomain}
            </span>
            <input
              placeholder="/путь для проверки"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-500">Порт (необязательно)</span>
          <input
            type="number"
            min={1}
            max={65535}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder={
              composeUrl(projectDomain, path).startsWith("http://")
                ? "по умолчанию 80"
                : "по умолчанию 443"
            }
            className={inputCls}
          />
        </label>
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
      </div>

      {/* Заголовки запроса */}
      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          Заголовки запроса
        </div>
        <div className="space-y-2">
          {headerRows.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Название (напр. Authorization)"
                value={row.key}
                onChange={(e) => updateHeader(i, "key", e.target.value)}
                className={`${inputCls} flex-1`}
              />
              <input
                placeholder="Значение (напр. Bearer …)"
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

      {/* Тело запроса — только для методов, которые его допускают */}
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
          {bodyType !== "NONE" && (
            <p className="mt-1 text-xs text-slate-400">
              Content-Type проставится автоматически (
              {bodyType === "JSON"
                ? "application/json"
                : bodyType === "XML"
                  ? "application/xml"
                  : "application/x-www-form-urlencoded"}
              ), если не задан вручную в заголовках.
            </p>
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
          {loading ? "Создаём…" : "Создать"}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
