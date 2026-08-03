"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import "rrweb/dist/style.css";

type PlayerState = "idle" | "loading" | "ready" | "empty" | "error";

// Метка таймлайна из логов сессии: время (epoch ms) + полная информация о событии.
type Marker = {
  t: number;
  kind: "error" | "slow";
  label: string;
  type?: string | null;
  message?: string | null;
  method?: string | null;
  route?: string | null;
  query?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  url?: string | null;
  reqBody?: string | null;
  resBody?: string | null;
  stack?: string | null;
};
// Метка, спозиционированная на дорожку: доля 0..1 + исходные данные для подсказки.
type PlacedMarker = Marker & { pct: number };

// Минимальный интерфейс rrweb Replayer, которым мы пользуемся.
type ReplayerLike = {
  getMetaData: () => { startTime: number; endTime: number; totalTime: number };
  getCurrentTime: () => number;
  play: (timeOffset?: number) => void;
  pause: (timeOffset?: number) => void;
  setConfig?: (config: { speed?: number }) => void;
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

/** Доступные скорости воспроизведения. */
const SPEEDS = [1, 2, 4, 8] as const;

/** Собирает все поля события в многострочный текст (для кнопки «Копировать»). */
function markerToText(m: Marker): string {
  const durSec =
    m.durationMs != null ? `${(m.durationMs / 1000).toFixed(2)} с (${m.durationMs} мс)` : null;
  const rows: Array<[string, string | number | null | undefined]> = [
    ["Тип", m.kind === "slow" ? "Медленный запрос" : "Ошибка"],
    ["Сообщение", m.message],
    ["Метод", m.method],
    ["Статус", m.statusCode],
    ["Длительность", durSec],
    ["Адрес", m.route],
    ["Query", m.query],
    ["Страница", m.url],
    ["Тело запроса", m.reqBody],
    ["Ответ", m.resBody],
    ["Стек", m.stack],
  ];
  return rows
    .filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

/**
 * Воспроизведение записи экрана сессии (rrweb).
 *
 * Пакет rrweb-player@2.1.0 при обычном инстанцировании не инициализирует Replayer (строится
 * пустая оболочка — был «белый экран»), поэтому рендерим через rrweb.Replayer напрямую и
 * рисуем свои контролы: play/pause, дорожка времени с перемоткой и маркеры ошибок (красные) и
 * медленных запросов (жёлтые). По наведению на маркер — карточка со всей информацией и копией.
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
  const pendingRef = useRef<{ events: RRWebEvent[]; markers: Marker[] } | null>(null);
  // Размеры записанного вьюпорта (из Meta-события) — нужны для пересчёта масштаба на resize.
  const vpRef = useRef<{ w: number; h: number }>({ w: 1280, h: 720 });
  // Выбранная скорость в ref — чтобы применить её к плееру сразу после создания.
  const speedRef = useRef<number>(1);

  const [state, setState] = useState<PlayerState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0); // текущее смещение, мс
  const [total, setTotal] = useState(0); // длительность записи, мс
  const [placed, setPlaced] = useState<PlacedMarker[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null); // открытая карточка маркера
  const [speed, setSpeedState] = useState(1); // скорость воспроизведения, ×

  const stopRaf = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

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

  // Вписывание записи в сцену по ШИРИНЕ и ВЫСОТЕ: scale = min(поШирине, поВысоте, 1), запись
  // центрируем по обеим осям.
  //
  // Высоту сцены задаёт CSS (h-[calc(100vh-16rem)]), а не JS: раньше rescale писал
  // frame.style.height, и ResizeObserver, наблюдавший тот же элемент, гонял высоту по кругу
  // (появилась/пропала полоса прокрутки → новый масштаб → новая высота). Плюс rrweb-событие
  // «resize» во время проигрывания меняло высоту кадра — из-за этого панель перемотки и
  // скорости прыгала при скролле. Теперь сцена неподвижна, меняется только transform записи.
  const rescale = useCallback(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const wrapper = frame.querySelector<HTMLElement>(".replayer-wrapper");
    const { w: vw, h: vh } = vpRef.current;
    if (!wrapper || !vw || !vh) return;
    const availW = frame.clientWidth || vw;
    const availH = frame.clientHeight || vh;
    const scale = Math.min(availW / vw, availH / vh, 1);
    wrapper.style.position = "absolute";
    wrapper.style.transformOrigin = "top left";
    wrapper.style.transform = `scale(${scale})`;
    wrapper.style.top = `${Math.max(0, (availH - vh * scale) / 2)}px`;
    wrapper.style.left = `${Math.max(0, (availW - vw * scale) / 2)}px`;
    wrapper.style.margin = "0";
  }, []);

  // Уничтожаем плеер и снимаем слушатели при размонтировании.
  useEffect(() => {
    const onResize = () => rescale();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      stopRaf();
      try {
        replayerRef.current?.pause();
        replayerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
    };
  }, [rescale, stopRaf]);

  // Построение плеера — только когда контейнер отрендерен и виден (state === "ready").
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
        const rep = new Replayer(
          events as unknown[] as ConstructorParameters<typeof Replayer>[0],
          { root: frame, showWarning: false, mouseTail: false, skipInactive: false },
        ) as unknown as ReplayerLike;
        replayerRef.current = rep;
        if (speedRef.current !== 1) rep.setConfig?.({ speed: speedRef.current });

        const meta = rep.getMetaData();
        setTotal(meta.totalTime);

        const mk: PlacedMarker[] = [];
        for (const m of markers) {
          if (typeof m.t !== "number") continue;
          const off = m.t - meta.startTime;
          if (off < 0 || off > meta.totalTime) continue;
          mk.push({ ...m, pct: clamp01(off / (meta.totalTime || 1)) });
        }
        setPlaced(mk);

        const metaEvent = events.find((e) => e.type === 4) as
          | { data?: { width?: number; height?: number } }
          | undefined;
        vpRef.current = {
          w: metaEvent?.data?.width || 1280,
          h: metaEvent?.data?.height || 720,
        };
        rep.pause(0); // показать первый кадр
        rescale();

        rep.on("resize", (payload: { width?: number; height?: number }) => {
          vpRef.current = {
            w: payload?.width || vpRef.current.w,
            h: payload?.height || vpRef.current.h,
          };
          rescale();
        });
        rep.on("finish", () => {
          setPlaying(false);
          stopRaf();
        });

        ro = new ResizeObserver(() => rescale());
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
      if (events.length < 2) {
        setState("empty");
        return;
      }
      if (!events.some((e) => e && typeof e === "object" && e.type === 2)) {
        setError("В записи нет полного снимка страницы — воспроизводить нечего.");
        setState("error");
        return;
      }
      pendingRef.current = { events, markers: Array.isArray(data.markers) ? data.markers : [] };
      setState("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
      setState("error");
    }
  }, [sessionId]);

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

  // Скорость меняется «на лету»: rrweb пересчитывает таймер в setConfig. Если метода нет
  // (старая сборка) — перезапускаем воспроизведение с текущей позиции.
  function setSpeed(next: number) {
    speedRef.current = next;
    setSpeedState(next);
    const rep = replayerRef.current;
    if (!rep) return;
    if (rep.setConfig) {
      rep.setConfig({ speed: next });
    } else if (playing) {
      rep.play(cur);
    }
  }

  function seekTo(t: number) {
    const rep = replayerRef.current;
    if (!rep || !total) return;
    const clamped = Math.max(0, Math.min(t, total));
    setCur(clamped);
    if (playing) rep.play(clamped);
    else rep.pause(clamped);
  }

  function seekFromClick(clientX: number, track: HTMLElement) {
    const rect = track.getBoundingClientRect();
    seekTo(clamp01((clientX - rect.left) / rect.width) * total);
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

      <div className={state === "ready" ? "" : "hidden"}>
        <div className="overflow-hidden rounded-t-xl border border-slate-200 bg-slate-950 dark:border-slate-800">
          {/* Сцена под rrweb.Replayer: высота фиксирована CSS, запись вписывается внутрь. */}
          <div
            ref={frameRef}
            className="relative mx-auto h-[calc(100vh-16rem)] min-h-[240px] w-full"
          />
        </div>

        {/* Панель управления — прилипает к низу экрана, чтобы не уезжать при скролле. */}
        <div className="sticky bottom-0 z-20 rounded-b-xl border border-t-0 border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900">
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
              className="relative h-6 flex-1"
              onClick={(e) => {
                if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.track)
                  seekFromClick(e.clientX, e.currentTarget);
              }}
            >
              <div
                data-track="1"
                className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 cursor-pointer rounded-full bg-slate-200 dark:bg-slate-700"
              />
              <div
                className="pointer-events-none absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand"
                style={{ width: `${curPct}%` }}
              />
              <div
                className="pointer-events-none absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow dark:border-slate-900"
                style={{ left: `${curPct}%` }}
              />

              {placed.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 z-20 -translate-x-1/2"
                  style={{ left: `${m.pct * 100}%` }}
                  onMouseEnter={() => setOpenIdx(i)}
                  onMouseLeave={() => setOpenIdx((v) => (v === i ? null : v))}
                >
                  {/* иконка над дорожкой + вертикальная рисочка */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      seekTo(m.pct * total);
                    }}
                    className={`block cursor-pointer ${m.kind === "slow" ? "text-amber-500" : "text-red-600"}`}
                    aria-label={m.kind === "slow" ? "Медленный запрос" : "Ошибка"}
                  >
                    {m.kind === "slow" ? <SlowIcon /> : <ErrorIcon />}
                  </button>
                  <span
                    className={`pointer-events-none absolute left-1/2 top-3 h-3 w-0.5 -translate-x-1/2 ${
                      m.kind === "slow" ? "bg-amber-500" : "bg-red-600"
                    }`}
                  />

                  {openIdx === i && <MarkerCard m={m} atRight={m.pct > 0.6} atLeft={m.pct < 0.4} />}
                </div>
              ))}
            </div>

            <span className="shrink-0 font-mono text-xs tabular-nums text-slate-500">
              {fmt(cur)} / {fmt(total)}
            </span>

            {/* Скорость воспроизведения */}
            <div
              className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 p-0.5 dark:border-slate-700"
              role="group"
              aria-label="Скорость воспроизведения"
            >
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSpeed(s)}
                  aria-pressed={speed === s}
                  className={`rounded-md px-2 py-1 font-mono text-xs tabular-nums transition-colors ${
                    speed === s
                      ? "bg-brand text-white"
                      : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Карточка со всей информацией о событии и кнопкой «Копировать». */
function MarkerCard({ m, atRight, atLeft }: { m: Marker; atRight: boolean; atLeft: boolean }) {
  // Горизонтальное выравнивание карточки, чтобы у краёв дорожки она не обрезалась.
  const pos = atLeft ? "left-0" : atRight ? "right-0" : "left-1/2 -translate-x-1/2";
  const durSec = m.durationMs != null ? `${(m.durationMs / 1000).toFixed(2)} с` : null;
  const rows: Array<[string, string | null | undefined]> = [
    ["Сообщение", m.message],
    ["Метод", m.method],
    ["Статус", m.statusCode != null ? String(m.statusCode) : null],
    ["Длительность", durSec],
    ["Адрес", m.route],
    ["Query", m.query],
    ["Страница", m.url],
    ["Тело запроса", m.reqBody],
    ["Ответ", m.resBody],
    ["Стек", m.stack],
  ];
  return (
    // pb-2 создаёт «мост» от иконки до карточки, чтобы курсор не терял наведение.
    <div className={`absolute bottom-full z-30 pb-2 ${pos}`}>
      <div className="w-80 max-w-[80vw] rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${
              m.kind === "slow" ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
            }`}
          >
            {m.kind === "slow" ? "🐢 Медленный запрос" : "⛔ Ошибка"}
          </span>
          <CopyButton text={markerToText(m)} />
        </div>
        <dl className="max-h-64 space-y-1.5 overflow-auto">
          {rows
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{k}</dt>
                <dd className="whitespace-pre-wrap break-words font-mono text-xs text-slate-700 dark:text-slate-200">
                  {v}
                </dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}

/** Кнопка копирования текста в буфер обмена с кратким подтверждением. */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        try {
          void navigator.clipboard.writeText(text).then(
            () => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            },
            () => {},
          );
        } catch {
          /* ignore */
        }
      }}
      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
    >
      {copied ? "Скопировано" : "Копировать"}
    </button>
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
