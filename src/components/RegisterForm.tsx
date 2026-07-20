"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function RegisterForm({ yandexEnabled }: { yandexEnabled: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось зарегистрироваться");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
        Готово! Мы отправили пароль на <b>{email}</b>. Проверьте почту и войдите.
        <br />
        Каждый сайт работает на бесплатном тарифе: до 300 сессий в сутки и
        хранение логов 12 часов.
      </div>
    );
  }

  return (
    <div className="mt-6">
      {yandexEnabled && (
        <>
          <button
            onClick={() => signIn("yandex", { callbackUrl: "/dashboard" })}
            className="w-full rounded-lg bg-[#fc3f1d] px-4 py-2.5 font-medium text-white hover:opacity-90"
          >
            Зарегистрироваться через Яндекс ID
          </button>
          <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
            или по почте
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {loading ? "Регистрируем…" : "Зарегистрироваться"}
        </button>
      </form>
    </div>
  );
}
