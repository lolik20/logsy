"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Периодически обновляет серверные компоненты страницы через router.refresh()
// (без полной перезагрузки). Используется там, где нет отдельного эндпоинта
// «сигнатуры» для сравнения — например, для списка сессий логирования.
// Скрытую вкладку не трогаем, чтобы не тратить запросы.
export function AutoRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
