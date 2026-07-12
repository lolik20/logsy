"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await fetch("/api/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось задать новый пароль");
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-sm text-red-600">
          Ссылка недействительна. Запросите сброс пароля заново.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Восстановить пароль
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 space-y-4">
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Пароль обновлён. Теперь войдите с новым паролем.
        </div>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-brand px-4 py-2.5 text-center font-medium text-white hover:bg-brand-dark"
        >
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <input
        type="password"
        required
        minLength={8}
        placeholder="Новый пароль (минимум 8 символов)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {loading ? "Сохраняем…" : "Задать пароль"}
      </button>
    </form>
  );
}
