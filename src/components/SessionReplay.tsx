"use client";

import { useEffect, useRef, useState } from "react";
import type RRWebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

type PlayerState = "idle" | "loading" | "ready" | "empty" | "error";

/**
 * Воспроизведение записи экрана сессии (rrweb) на странице сессии в панели.
 *
 * Запись бывает объёмной, поэтому не грузим её при открытии страницы: по кнопке
 * «Смотреть запись» тянем события с /api/recordings/[sessionId], динамически
 * подгружаем rrweb-player (только на клиенте — плееру нужен DOM) и строим плеер с
 * таймлайном и управлением. rrweb-player — Svelte-компонент, поэтому создаём его в
 * контейнере императивно и уничтожаем при размонтировании.
 */
export function SessionReplay({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RRWebPlayer | null>(null);
  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Уничтожаем плеер при размонтировании компонента.
  useEffect(() => {
    return () => {
      try {
        // rrweb-player — Svelte-компонент: у него в рантайме есть $destroy (типы его не
        // экспонируют публично, поэтому обращаемся через приведение).
        (playerRef.current as unknown as { $destroy?: () => void })?.$destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, []);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${sessionId}`);
      if (!res.ok) throw new Error("Не удалось загрузить запись");
      const data = (await res.json()) as { events?: unknown };
      const events = Array.isArray(data.events) ? data.events : [];
      // rrweb требует минимум два события (полный снимок + хотя бы один инкремент).
      if (events.length < 2) {
        setState("empty");
        return;
      }

      const mod = await import("rrweb-player");
      const RRWebPlayerCtor = mod.default;

      const container = containerRef.current;
      if (!container) return;
      container.innerHTML = ""; // на случай повторного построения

      // Ширину плеера подгоняем под контейнер, высоту — в пропорции 16:10.
      const width = Math.max(320, container.clientWidth || 900);
      const height = Math.round(width * 0.62);

      type PlayerEvents = ConstructorParameters<typeof RRWebPlayerCtor>[0]["props"]["events"];
      playerRef.current = new RRWebPlayerCtor({
        target: container,
        props: {
          events: events as unknown as PlayerEvents,
          width,
          height,
          autoPlay: false,
          showController: true,
        },
      });
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
      setState("error");
    }
  }

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Запись экрана</h2>
        {state === "idle" && (
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Смотреть запись
          </button>
        )}
        {state === "loading" && (
          <span className="text-sm text-slate-500">Загрузка записи…</span>
        )}
      </div>

      {state === "empty" && (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Запись для этой сессии пока пустая — событий недостаточно для воспроизведения.
        </p>
      )}
      {state === "error" && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30">
          {error ?? "Не удалось воспроизвести запись"}
        </p>
      )}

      {/* Контейнер плеера. Пока запись не загружена — скрыт (плеер строится императивно). */}
      <div
        ref={containerRef}
        className={
          state === "ready"
            ? "overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
            : "hidden"
        }
      />
    </div>
  );
}
