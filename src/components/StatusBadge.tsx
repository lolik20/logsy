export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    UP: { label: "Работает", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
    DOWN: { label: "Недоступен", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
    PENDING: { label: "Ожидает", cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  };
  const s = map[status] ?? map.PENDING;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  );
}
