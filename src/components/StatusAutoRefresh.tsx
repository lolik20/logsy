"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

// Опрашивает /api/monitors/status и, если статусы мониторов изменились,
// мягко обновляет серверные компоненты страницы через router.refresh() —
// без полной перезагрузки. Ничего не рендерит.
export function StatusAutoRefresh({
  initialSignature,
  projectId,
  monitorId,
  scope,
  intervalMs = 15000,
}: {
  initialSignature: string;
  projectId?: string;
  monitorId?: string;
  // "all" — для админской панели: опрашивать статусы мониторов всех пользователей.
  scope?: "all";
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastSignature = useRef(initialSignature);

  // После router.refresh() страница перерисовывается и присылает свежую
  // подпись — синхронизируем её, чтобы не зациклить обновления.
  useEffect(() => {
    lastSignature.current = initialSignature;
  }, [initialSignature]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (monitorId) params.set("monitorId", monitorId);
    if (scope) params.set("scope", scope);
    const qs = params.toString();
    const url = `/api/monitors/status${qs ? `?${qs}` : ""}`;

    let stopped = false;

    async function poll() {
      // Не опрашиваем скрытую вкладку — экономим запросы.
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const data = (await res.json()) as { signature?: string };
        if (stopped) return;
        if (
          typeof data.signature === "string" &&
          data.signature !== lastSignature.current
        ) {
          lastSignature.current = data.signature;
          router.refresh();
        }
      } catch {
        // сеть недоступна — попробуем на следующем тике
      }
    }

    const id = setInterval(poll, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [router, projectId, monitorId, scope, intervalMs]);

  return null;
}
