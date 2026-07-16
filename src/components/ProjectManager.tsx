"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProjectManager({ canAdd }: { canAdd: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось создать проект");
      return;
    }
    setDomain("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div>
        <button
          onClick={() => setOpen(true)}
          disabled={!canAdd}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          title={canAdd ? "" : "Достигнут лимит тарифа — оформите подписку"}
        >
          + Добавить проект
        </button>
        {!canAdd && (
          <p className="mt-2 text-sm text-slate-500">
            Достигнут лимит сайтов по тарифу. Увеличьте лимит в разделе «Тарифы».
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h3 className="mb-4 font-semibold">Новый проект</h3>
      <div className="grid gap-3">
        <input
          required
          placeholder="Домен (напр. example.ru)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
        />
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
