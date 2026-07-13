"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Кнопка «В исключения» напротив события лога. Добавляет сигнатуру события (тип +
 * сообщение + маршрут) в игнор-лист проекта: правило действует на весь проект — уже
 * записанные такие же события удаляются во всех сессиях, будущие не сохраняются.
 * Снять правило можно в блоке «Исключения» на странице логов проекта.
 */
export function AddExceptionButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onClick() {
    if (
      !confirm(
        "Скрыть такие ошибки во всём проекте? Уже записанные будут удалены, " +
          "новые перестанут сохраняться. Снять правило можно в блоке «Исключения».",
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch("/api/logger/exceptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setLoading(false);
      alert("Не удалось добавить в исключения");
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      title="Больше не сохранять такие события во всём проекте"
      className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:border-amber-400 hover:text-amber-600 disabled:opacity-60 dark:border-slate-700"
    >
      В исключения
    </button>
  );
}
