"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css";

type PlayerState = "idle" | "loading" | "ready" | "empty" | "error";

// Метка таймлайна из логов сессии: время (epoch ms), тип и подпись для тултипа.
type Marker = { t: number; kind: "error" | "slow"; label: string };
// Позиционированная метка для дорожки времени: доля 0..1 от длины записи + подпись.
type PlacedMarker = { pct: number; kind: "error" | "slow"; label: string };

// Минимальный интерфейс rrweb Replayer, которым мы пользуемся. Полные типы тянут за собой
// весь rrweb; нам нужны только эти методы, поэтому описываем их точечно.
type ReplayerLike = {
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  getCurrentTime: () => number;
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, handler: (...args: any[]) => void) => void;
  destroy?: () => void;
};

/** mm:ss из миллисекунд. */
function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Воспроизведение записи экрана сессии (rrweb).
 *
 * Раньше использовался пакет rrweb-player, но в версии 2.1.0 его Svelte-обёртка при обычном
 * инстанцировании (new rrwebPlayer({ target, props })) НЕ инициализирует Replayer — строится
 * только пустая оболочка, отсюда был «белый экран». Поэтому рендерим через rrweb.Replayer
 * напрямую и рисуем свои контролы: кнопка play/pause, дорожка времени с перемоткой и
 * маркерами ошибок (красные) и медленных запросов (жёлтые) — с иконкой и подписью по наведению.
 */
export function SessionReplay({
  sessionId,
  className,
  autoLoad,
}: {
  sessionId: string;
  /** Переопределяет внешний отступ корня (по умолчанию mt-8). */
  className?: string;
  /** Начать загрузку и построение плеера сразу при монтировании, без кнопки. */
  autoLoad?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const replayerRef = useRef<ReplayerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);
  // Данные записи, дождавшиеся показа контейнера (плеер строится в эффекте, когда он виден).
  const pendingRef = useRef<{ events: RRWebEvent[]; markers: Marker[] } | null>(null);

  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0); // текущее смещение, мс
  const [total, setTotal] = useState(0); // длительность записи, мс
  const [placed, setPlaced] = useState<PlacedMarker[]>([]);

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  // Цикл обновления бегунка во время воспроизведения.
  const startRaf = useCallback(
    (totalMs: number) => {
      stopRaf();
      const tick = () => {
        const rep = replayerRef.current;
        if (!rep) return;
        const t = rep.getCurrentTime();
        setCur(t < 0 ? 0 : t > totalMs ? totalMs : t);
        if (t >= totalMs) {
          setPlaying(false);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [stopRaf],
  );

  // Масштабирование записи под ширину контейнера. rrweb рендерит iframe в размерах
  // записанного вьюпорта (Meta-событие); мы вписываем .replayer-wrapper в контейнер.
  const rescale = useCallback((vw: number, vh: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const wrapper = frame.querySelector<HTMLElement>(".replayer-wrapper");
    if (!wrapper || !vw || !vh) return;
    const avail = frame.clientWidth || vw;
    const scale = avail / vw;
    wrapper.style.transformOrigin = "top left";
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.margin = "0";
    frame.style.height = `${Math.round(vh * scale)}px`;
  }, []);

  // Уничтожаем плеер и останавливаем цикл при размонтировании.
  useEffect(() => {
    return () => {
      stopRaf();
      try {
        replayerRef.current?.pause();
        replayerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [stopRaf]);

  // Построение плеера. Только в состоянии "ready", когда контейнер уже отрендерен и виден
  // (rrweb-обёртке и масштабированию нужны реальные размеры контейнера).
  useEffect(() => {
    if (state !== "ready" || !pendingRef.current) return;
    const { events, markers } = pendingRef.current;
    pendingRef.current = null;
    const frame = frameRef.current;
    if (!frame) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    (async () => {
      try {
        const { Replayer } = await import("rrweb");
        if (cancelled) return;
        frame.innerHTML = "";
        const rep = new Replayer(events as unknown[] as ConstructorParameters<typeof Replayer>[0], {
          root: frame,
          showWarning: false,
          mouseTail: false,
          skipInactive: false,
        }) as unknown as ReplayerLike;
        replayerRef.current = rep;

        const meta = rep.getMetaData();
        setTotal(meta.totalTime);

        // Метки → доли по времени записи (за пределы диапазона не показываем).
        const mk: PlacedMarker[] = [];
        for (const m of markers) {
          if (typeof m.t !== "number") continue;
          const off = m.t - meta.startTime;
          if (off < 0 || off > meta.totalTime) continue;
          mk.push({ pct: clamp01(off / (meta.totalTime || 1)), kind: m.kind, label: m.label });
        }
        setPlaced(mk);

        // Размеры записанного вьюпорта из Meta-события — для масштаба.
        const metaEvent = events.find((e) => e.type === 4) as
          | { data?: { width?: number; height?: number } }
          | undefined;
        let vw = metaEvent?.data?.width || 1280;
        let vh = metaEvent?.data?.height || 720;
        rep.pause(0); // показать первый кадр
        rescale(vw, vh);

        // Смена вьюпортом размера в течение сессии — пересчитываем масштаб.
        rep.on("resize", (payload: { width?: number; height?: number }) => {
          if (payload?.width) vw = payload.width;
          if (payload?.height) vh = payload.height;
          rescale(vw, vh);
        });
        rep.on("finish", () => {
          setPlaying(false);
          stopRaf();
        });

        // Реагируем на изменение ширины контейнера (адаптив).
        ro = new ResizeObserver(() => rescale(vw, vh));
        ro.observe(frame);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [state, rescale, stopRaf]);

  const load = useCallback(async () => {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${sessionId}`);
      if (!res.ok) throw new Error("Не удалось загрузить запись");
      const data = (await res.json()) as { events?: unknown; markers?: Marker[] };
      const events = (Array.isArray(data.events) ? data.events : []) as RRWebEvent[];
      // rrweb требует минимум два события (полный снимок + хотя бы один инкремент).
      if (events.length < 2) {
        setState("empty");
        return;
      }
      // Без полного снимка DOM (rrweb type 2) плееру нечего отрисовать.
      if (!events.some((e) => e && typeof e === "object" && e.type === 2)) {
        setError("В записи нет полного снимка страницы — воспроизводить нечего.");
        setState("error");
        return;
      }
      pendingRef.current = { events, markers: Array.isArray(data.markers) ? data.markers : [] };
      // Показываем контейнер (ready) → эффект построит в нём плеер.
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
      setState("error");
    }
  }, [sessionId]);

  // Автозапуск (для выделенной страницы воспроизведения): грузим сразу, без кнопки.
  useEffect(() => {
    if (autoLoad && !startedRef.current) {
      startedRef.current = true;
      void load();
    }
  }, [autoLoad, load]);

  function toggle() {
    const rep = replayerRef.current;
    if (!rep) return;
    if (playing) {
      rep.pause();
      setPlaying(false);
      stopRaf();
    } else {
      const from = cur >= total ? 0 : cur;
      rep.play(from);
      setPlaying(true);
      startRaf(total);
    }
  }

  function seek(clientX: number, track: HTMLElement) {
    const rep = replayerRef.current;
    if (!rep || !total) return;
    const rect = track.getBoundingClientRect();
    const pct = clamp01((clientX - rect.left) / rect.width);
    const t = pct * total;
    setCur(t);
    if (playing) rep.play(t);
    else rep.pause(t);
  }

  const curPct = total ? clamp01(cur / total) * 100 : 0;

  return (
    <div className={className ?? "mt-8"}>
      {state === "idle" && (
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          <PlayIcon />
          Смотреть запись
        </button>
      )}
      {state === "loading" && <span className="text-sm text-slate-500">Загрузка записи…</span>}

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

      {/* Плеер: область записи + собственные контролы. Виден в состоянии ready. */}
      <div className={state === "ready" ? "" : "hidden"}>
        <div className="overflow-hidden rounded-t-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
          {/* Контейнер под rrweb.Replayer (масштабируется по ширине). */}
          <div ref={frameRef} className="relative w-full" />
        </div>

        {/* Панель управления */}
        <div className="rounded-b-xl border border-t-0 border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggle}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white hover:opacity-90"
              aria-label={playing ? "Пауза" : "Воспроизвести"}
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            {/* Дорожка времени с маркерами */}
            <div
              className="relative h-6 flex-1 cursor-pointer select-none"
              onClick={(e) => seek(e.clientX, e.currentTarget)}
            >
              {/* фон дорожки */}
              <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200 dark:bg-slate-700" />
              {/* заполнение */}
              <div
                className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
                style={{ width: `${curPct}%` }}
              />
              {/* бегунок */}
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow dark:border-slate-900"
                style={{ left: `${curPct}%` }}
              />
              {/* маркеры ошибок/медленных */}
              {placed.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 z-10 -translate-x-1/2"
                  style={{ left: `${m.pct * 100}%` }}
                  title={`${m.kind === "slow" ? "🐢 Медленный запрос" : "⛔ Ошибка"} · ${m.label}`}
                >
                  {/* иконка над дорожкой */}
                  <span
                    className={
                      m.kind === "slow"
                        ? "block text-amber-500"
                        : "block text-red-600"
                    }
                  >
                    {m.kind === "slow" ? <SlowIcon /> : <ErrorIcon />}
                  </span>
                  {/* вертикальная рисочка на дорожке */}
                  <span
                    className={`absolute left-1/2 top-3 h-3 w-0.5 -translate-x-1/2 ${
                      m.kind === "slow" ? "bg-amber-500" : "bg-red-600"
                    }`}
                  />
                </div>
              ))}
            </div>

            <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">
              {fmt(cur)} / {fmt(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Минимальная форма события rrweb: тип и время (для поиска Meta/снимка и границ).
type RRWebEvent = { type: number; timestamp: number; data?: unknown };

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function SlowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}
