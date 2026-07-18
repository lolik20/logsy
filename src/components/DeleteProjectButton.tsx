"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (!confirm("Удалить сайт со всеми мониторами и историей?")) return;
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setLoading(false);
      alert("Не удалось удалить сайт");
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 disabled:opacity-60 dark:border-slate-700"
    >
      Удалить сайт
    </button>
  );
}
