"use client";

import { useRouter, usePathname } from "next/navigation";

// Фильтр сессий по дате. Меняет query-параметр ?date=YYYY-MM-DD и перезагружает данные.
export function LogDateFilter({ value }: { value: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function onChange(next: string) {
    const params = new URLSearchParams();
    if (next) params.set("date", next);
    router.replace(`${pathname}${params.toString() ? `?${params}` : ""}`);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-slate-500">
      Дата
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-slate-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-brand dark:border-slate-700"
      />
    </label>
  );
}
