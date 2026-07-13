"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Кнопка «В исключения» напротив события лога. Добавляет сигнатуру события в игнор-лист
 * проекта (POST /api/logger/exceptions) — будущие такие же события не сохраняются.
 * Повторный клик снимает правило (DELETE). Уже сохранённые события не удаляются.
 */
export function AddExceptionButton({
  eventId,
  excluded: initialExcluded,
}: {
  eventId: string;
  excluded: boolean;
}) {
  const router = useRouter();
  const [excluded, setExcluded] = useState(initialExcluded);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = excluded ? "DELETE" : "POST";
    const res = await fetch("/api/logger/exceptions", {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    setLoading(false);
    if (res.ok) {
      setExcluded(!excluded);
      router.refresh();
    } else {
      alert(excluded ? "Не удалось убрать из исключений" : "Не удалось добавить в исключения");
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={
        excluded
          ? "Такие события снова будут сохраняться"
          : "Больше не сохранять такие события"
      }
      className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-60 ${
        excluded
          ? "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700"
          : "border-slate-300 hover:border-amber-400 hover:text-amber-600 dark:border-slate-700"
      }`}
    >
      {excluded ? "В исключениях" : "В исключения"}
    </button>
  );
}
