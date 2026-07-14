"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Фильтр сессий «с ошибками». При включении добавляет query-параметр ?errors=1 —
// на странице логов остаются только сессии, в которых были ошибки. Дата сохраняется.
export function LogErrorFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = searchParams.get("errors") === "1";

  function toggle() {
    const params = new URLSearchParams(searchParams.toString());
    if (active) params.delete("errors");
    else params.set("errors", "1");
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
        active
          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-900/20 dark:text-red-300"
          : "border-slate-300 text-slate-500 hover:border-brand dark:border-slate-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${active ? "bg-red-600" : "bg-slate-400"}`}
      />
      С ошибками
    </button>
  );
}
