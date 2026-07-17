"use client";

import { useEffect, useRef, useState } from "react";
import type RRWebPlayer from "rrweb-player";
import "rrweb-player/dist/style.css";

// mounting — контейнер уже показан, плеер строится в нём (см. useEffect ниже). Это
// отдельное состояние специально: плеер ОБЯЗАН строиться в видимом контейнере.
type PlayerState = "idle" | "loading" | "mounting" | "ready" | "empty" | "error";

// Минимальная форма события rrweb, которой нам достаточно: тип и время (для сортировки и
// проверки снимка). Остальные поля плеер разбирает сам. type 5 — Custom (наши метки).
type RRWebEvent = { type: number; timestamp: number; data?: unknown };

/**
 * Воспроизведение записи экрана сессии (rrweb) на странице сессии в панели.
 *
 * Запись бывает объёмной, поэтому не грузим её при открытии страницы: по кнопке
 * «Смотреть запись» тянем события с /api/recordings/[sessionId], динамически
 * подгружаем rrweb-player (только на клиенте — плееру нужен DOM) и строим плеер с
 * таймлайном и управлением. rrweb-player — Svelte-компонент, поэтому создаём его в
 * контейнере императивно и уничтожаем при размонтировании.
 */
export function SessionReplay({
  sessionId,
  label,
  className,
  autoLoad,
}: {
  sessionId: string;
  /** Подпись вместо заголовка «Запись экрана» — например, метка и время сессии.
   *  Нужна, когда на странице несколько записей (combined-вид сессий одного IP). */
  label?: string;
  /** Переопределяет внешний отступ корня (по умолчанию mt-8). */
  className?: string;
  /** Начать загрузку и построение плеера сразу при монтировании, без кнопки.
   *  Используется на выделенной странице воспроизведения записи. */
  autoLoad?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RRWebPlayer | null>(null);
  // Гард от повторного автозапуска (в dev React монтирует компонент дважды).
  const startedRef = useRef(false);
  // Загруженные события храним в ref, а не в state: они не влияют на разметку и не должны
  // вызывать лишний ре-рендер. Плеер строится в отдельном эффекте, когда контейнер виден.
  const eventsRef = useRef<unknown[] | null>(null);
  // Карта «имя метки → цвет» для рисочек на таймлайне (ошибки/медленные запросы).
  const tagsRef = useRef<Record<string, string>>({});
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

  // Построение плеера. Запускается ТОЛЬКО в состоянии "mounting", когда контейнер уже
  // отрендерен видимым. Почему так важно: rrweb-player при монтировании вычисляет масштаб
  // от РАЗМЕРОВ контейнера/iframe. Если строить его в скрытом (display:none) блоке, ширина
  // равна 0 → масштаб 0 → после показа остаётся БЕЛЫЙ ЭКРАН, и сам плеер масштаб не
  // пересчитывает. Раньше плеер строился в скрытом контейнере — отсюда пустой белый кадр.
  useEffect(() => {
    if (state !== "mounting") return;
    const events = eventsRef.current;
    const container = containerRef.current;
    if (!events || !container) return;

    let cancelled = false;
    (async () => {
      try {
        const mod = await import("rrweb-player");
        if (cancelled) return;
        const RRWebPlayerCtor = mod.default;

        container.innerHTML = ""; // на случай повторного построения

        // Ширину плеера подгоняем под контейнер (теперь он виден — clientWidth реальный),
        // высоту — в пропорции 16:10.
        const width = Math.max(320, container.clientWidth || 900);
        const height = Math.round(width * 0.62);

        type PlayerEvents = ConstructorParameters<typeof RRWebPlayerCtor>[0]["props"]["events"];
        const player = new RRWebPlayerCtor({
          target: container,
          props: {
            events: events as unknown as PlayerEvents,
            width,
            height,
            autoPlay: false,
            showController: true,
            // Рисочки на таймлайне: красные (ошибки) и жёлтые (медленные запросы).
            // Плеер красит метку в tags[имя] и показывает имя как тултип по наведению.
            tags: tagsRef.current,
          },
        });
        playerRef.current = player;

        // Подстраховка от белого экрана: после того как первый кадр (снимок DOM) построен
        // и iframe получил размеры, принудительно пересчитываем масштаб под контейнер.
        const rerender = () => {
          try {
            (player as unknown as { triggerResize?: () => void }).triggerResize?.();
          } catch {
            /* ignore */
          }
        };
        requestAnimationFrame(rerender);
        setTimeout(rerender, 300);

        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
          setState("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [state]);

  async function load() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch(`/api/recordings/${sessionId}`);
      if (!res.ok) throw new Error("Не удалось загрузить запись");
      const data = (await res.json()) as {
        events?: unknown;
        markers?: Array<{ t: number; kind: "error" | "slow"; label: string }>;
      };
      const events = (Array.isArray(data.events) ? data.events : []) as RRWebEvent[];
      // rrweb требует минимум два события (полный снимок + хотя бы один инкремент).
      if (events.length < 2) {
        setState("empty");
        return;
      }
      // Без полного снимка DOM (rrweb type 2 = FullSnapshot) плееру нечего отрисовать —
      // это тоже выглядит как «белый экран». Сообщаем понятной ошибкой, а не пустотой.
      const hasSnapshot = events.some((e) => e && typeof e === "object" && e.type === 2);
      if (!hasSnapshot) {
        setError("В записи нет полного снимка страницы — воспроизводить нечего.");
        setState("error");
        return;
      }

      // Метки таймлайна: ошибки и медленные запросы сессии подмешиваем в поток как
      // Custom-события rrweb (type 5). Плеер рисует их рисочками на дорожке времени и
      // показывает подпись по наведению; цвет берёт из карты tags по имени метки.
      // Границы времени записи считаем проходом (без spread: записей бывают тысячи, и
      // Math.min(...bigArray) может переполнить стек аргументов).
      let firstTs = Infinity;
      let lastTs = -Infinity;
      for (const e of events) {
        if (typeof e.timestamp !== "number") continue;
        if (e.timestamp < firstTs) firstTs = e.timestamp;
        if (e.timestamp > lastTs) lastTs = e.timestamp;
      }
      const tags: Record<string, string> = {};
      const markerEvents: RRWebEvent[] = [];
      for (const m of data.markers ?? []) {
        // Метка вне диапазона записи сломала бы порядок (первым событием обязан быть снимок),
        // поэтому берём только те, что попадают во временной интервал записи.
        if (typeof m.t !== "number" || m.t < firstTs || m.t > lastTs) continue;
        const icon = m.kind === "slow" ? "🐢 " : "⛔ ";
        const fallback = m.kind === "slow" ? "Медленный запрос" : "Ошибка";
        const tag = icon + (m.label || fallback);
        tags[tag] = m.kind === "slow" ? "#f59e0b" : "#dc2626";
        markerEvents.push({ type: 5, timestamp: m.t, data: { tag, payload: {} } });
      }
      // Плееру нужен поток строго по времени — объединяем и сортируем.
      const merged = markerEvents.length
        ? [...events, ...markerEvents].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
        : events;

      // Кладём события и переходим в "mounting": это отрендерит ВИДИМЫЙ контейнер, после
      // чего эффект выше построит в нём плеер (в видимом блоке масштаб считается верно).
      eventsRef.current = merged;
      tagsRef.current = tags;
      setState("mounting");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка воспроизведения");
      setState("error");
    }
  }

  // Автозапуск (для выделенной страницы воспроизведения): грузим сразу, без кнопки.
  useEffect(() => {
    if (autoLoad && !startedRef.current) {
      startedRef.current = true;
      void load();
    }
    // load стабилен по смыслу (зависит только от sessionId); намеренно запускаем один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoad]);

  // Контейнер должен быть виден и на этапе построения ("mounting"), и когда плеер готов
  // ("ready") — иначе плеер строится в скрытом блоке и остаётся белым (см. эффект выше).
  const containerVisible = state === "mounting" || state === "ready";

  return (
    <div className={className ?? "mt-8"}>
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-lg font-semibold">{label ?? "Запись экрана"}</h2>
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
        {(state === "loading" || state === "mounting") && (
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

      {/* Контейнер плеера. Виден уже на этапе построения — плеер строится в видимом блоке. */}
      <div
        ref={containerRef}
        className={
          containerVisible
            ? "overflow-hidden rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900"
            : "hidden"
        }
      />
    </div>
  );
}
