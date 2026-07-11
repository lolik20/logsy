"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; value: string };

export function ContactManager({ contacts }: { contacts: Contact[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось добавить контакт");
      return;
    }
    setValue("");
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Удалить контакт?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input
          required
          type="email"
          placeholder="email@example.ru"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Добавляем…" : "Добавить"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid gap-2">
        {contacts.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
            Пока нет контактов. Добавьте email, чтобы получать алерты.
          </p>
        )}
        {contacts.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <span>✉️ {c.value}</span>
            <button
              onClick={() => remove(c.id)}
              className="text-sm text-slate-400 hover:text-red-600"
            >
              Удалить
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
