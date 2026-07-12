"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export function QuickAuth() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setError("Ссылка недействительна.");
      return;
    }

    signIn("quick-link", { token, redirect: false }).then((res) => {
      if (res?.error) {
        setError("Ссылка недействительна или устарела. Войдите по паролю.");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }, [token, router]);

  if (error) {
    return (
      <div className="mt-6 space-y-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-brand px-4 py-2.5 font-medium text-white hover:bg-brand-dark"
        >
          Перейти ко входу
        </Link>
      </div>
    );
  }

  return (
    <p className="mt-6 text-center text-sm text-slate-500">Входим…</p>
  );
}
