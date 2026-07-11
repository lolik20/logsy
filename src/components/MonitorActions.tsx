"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MonitorActions({
  monitorId,
  isActive,
}: {
  monitorId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/monitors/${monitorId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Удалить монитор и его историю?")) return;
    setBusy(true);
    const res = await fetch(`/api/monitors/${monitorId}`, { method: "DELETE" });
    if (res.ok) {
      router.back();
      router.refresh();
    } else {
      setBusy(false);
      alert("Не удалось удалить монитор");
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand disabled:opacity-60 dark:border-slate-700"
      >
        {isActive ? "Приостановить" : "Возобновить"}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 disabled:opacity-60 dark:border-slate-700"
      >
        Удалить
      </button>
    </div>
  );
}
