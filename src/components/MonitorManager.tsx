"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
const INTERVALS: { value: string; label: string }[] = [
  { value: "1m", label: "1 минута" },
  { value: "1h", label: "1 час" },
  { value: "1d", label: "1 день" },
];

export function MonitorManager({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]>("GET");
  const [interval, setInterval] = useState("1m");
  const [expectedStatus, setExpectedStatus] = useState("200");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/monitors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        projectId,
        name,
        url,
        method,
        interval,
        expectedStatus: Number(expectedStatus),
      }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось создать монитор");
      return;
    }
    setName("");
    setUrl("");
    setMethod("GET");
    setInterval("1m");
    setExpectedStatus("200");
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
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          required
          placeholder="Название (напр. Главная страница)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputCls}
        />
        <input
          required
          type="url"
          placeholder="URL для проверки (https://…)"
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
      </div>
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
          onClick={() => setOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
