import { Suspense } from "react";
import Link from "next/link";
import { QuickAuth } from "@/components/QuickAuth";

export default function QuickAuthPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-brand">
          Logsy
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold">Быстрый вход</h1>
          <Suspense
            fallback={
              <p className="mt-6 text-center text-sm text-slate-500">Входим…</p>
            }
          >
            <QuickAuth />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
