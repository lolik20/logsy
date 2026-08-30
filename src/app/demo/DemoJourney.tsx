"use client";

// Интерактивное демо клиентского пути. Все данные — макетные, все действия
// посетителя (плеер, отправка демо-жалобы) живут в локальном состоянии страницы:
// ничего не уходит на сервер и не сохраняется.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// ------------------------------- Общие детали -------------------------------

/** Номер шага в круглом бейдже + заголовок. */
function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 sm:items-center">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-light text-base font-bold text-white shadow-card">
        {n}
      </span>
      <h2 className="text-2xl font-bold leading-tight sm:text-3xl">{children}</h2>
    </div>
  );
}

/** Верхняя панель «окна браузера» для макетов. */
function BrowserBar({ url, extra }: { url: string; extra?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/60">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900">
        {url}
      </span>
      {extra}
    </div>
  );
}

const cardCls =
  "mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900";

// ---------------------------- Шаг 4: плеер записи ----------------------------

const REPLAY_SECONDS = 47;
/** Метки на таймлайне записи: позиция в %, подпись и цвет. */
const REPLAY_MARKS = [
  { at: 55, cls: "bg-amber-500", title: "Медленный запрос /api/checkout · 1240 мс" },
  { at: 72, cls: "bg-red-500", title: "HTTP 500 /api/pay" },
];

function ReplayPlayer() {
  const [progress, setProgress] = useState(0); // 0..100
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          setPlaying(false);
          return 100;
        }
        return p + 0.5;
      });
    }, 60);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing]);

  const sec = Math.round((progress / 100) * REPLAY_SECONDS);
  const time = `0:${String(sec).padStart(2, "0")}`;
  // Возле красной метки «показываем» момент ошибки на кадре.
  const atError = progress >= REPLAY_MARKS[1].at;

  return (
    <div className={cardCls}>
      <BrowserBar
        url="example.ru/checkout"
        extra={
          <span className="flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            REC
          </span>
        }
      />
      {/* «Кадр» записи: до ошибки — обычный чекаут, после — красное сообщение */}
      <div className="relative h-52 bg-white p-4 dark:bg-slate-900">
        <div className="space-y-2.5">
          <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-2.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
          <div className="h-16 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center gap-2">
            <div
              className={`flex h-9 w-32 items-center justify-center rounded-lg text-xs font-semibold ${
                atError
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  : "bg-brand/20 text-brand"
              }`}
            >
              {atError ? "Ошибка оплаты" : "Оплатить"}
            </div>
            {atError && (
              <span className="font-mono text-[10px] text-red-600">POST /api/pay → 500</span>
            )}
          </div>
        </div>
        {!playing && progress === 0 && (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label="Воспроизвести запись"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/90 text-white shadow-lg backdrop-blur transition-transform hover:scale-105">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {/* Панель плеера */}
      <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              if (progress >= 100) setProgress(0);
              setPlaying((v) => !v);
            }}
            aria-label={playing ? "Пауза" : "Воспроизвести"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <div className="relative h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-brand"
              style={{ width: `${progress}%` }}
            />
            {REPLAY_MARKS.map((m) => (
              <button
                key={m.at}
                type="button"
                title={m.title}
                aria-label={m.title}
                onClick={() => {
                  setProgress(m.at);
                  setPlaying(true);
                }}
                className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white ${m.cls}`}
                style={{ left: `${m.at}%` }}
              />
            ))}
          </div>
          <span className="shrink-0 font-mono text-[10px] text-slate-400">
            {time} / 0:{REPLAY_SECONDS}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Метки на дорожке кликабельны — перематывают к тормозу и к ошибке.
        </p>
      </div>
    </div>
  );
}

// ------------------- Шаг 6: жалоба превращается в задачу -------------------

type DemoTask = { id: number; title: string; meta: string; fresh?: boolean };

function FeedbackToTask() {
  const [text, setText] = useState("");
  const [created, setCreated] = useState<DemoTask[]>([
    { id: 1, title: "Медленный /catalog (2,1 с)", meta: "Сессия #4818" },
  ]);
  const [sent, setSent] = useState(false);
  const nextId = useRef(2);

  function submit() {
    const title = text.trim() || "Не проходит оплата на последнем шаге";
    setCreated((list) => [
      { id: nextId.current++, title, meta: "Сессия #7042 · только что", fresh: true },
      ...list,
    ]);
    setText("");
    setSent(true);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Виджет обратной связи — как выглядит у посетителя */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card dark:border-slate-700/70 dark:bg-slate-900">
        <p className="text-sm font-bold text-slate-900 dark:text-white">Сообщить об ошибке</p>
        <p className="mt-0.5 text-xs text-slate-500">
          Так виджет выглядит у посетителя. Отправьте демо-жалобу →
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Например: не проходит оплата на последнем шаге"
          className="mt-3 w-full rounded-lg border border-brand/40 bg-white p-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">Демо: никуда не отправляется</span>
          <button
            type="button"
            onClick={submit}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Отправить
          </button>
        </div>
        {sent && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
            Задача создана — она уже в колонке «Создано». В реальном проекте вам
            придёт письмо и сообщение в Telegram со ссылкой на сессию автора.
          </p>
        )}
      </div>

      {/* Мини-доска задач — куда жалоба попадает */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/70">
          <span className="text-xs font-semibold text-slate-500">Доска задач · example.ru</span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
            {created.length + 2} задач
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 text-left">
          {[
            { title: "Создано", dot: "bg-slate-400", cards: created },
            {
              title: "В работе",
              dot: "bg-blue-500",
              cards: [{ id: -1, title: "TypeError в checkout.js", meta: "Сессия #4805" }],
            },
            {
              title: "Выполнено",
              dot: "bg-emerald-500",
              cards: [{ id: -2, title: "404 на /promo", meta: "Сессия #4750" }],
            },
          ].map((col) => (
            <div key={col.title} className="rounded-xl bg-slate-50 p-2 dark:bg-slate-800/50">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                {col.title}
              </div>
              <div className="space-y-1.5">
                {col.cards.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-lg border bg-white p-2 dark:bg-slate-900 ${
                      c.fresh
                        ? "animate-fade-in border-brand/60 ring-1 ring-brand/25"
                        : "border-slate-200/80 dark:border-slate-700/70"
                    }`}
                  >
                    <p className="line-clamp-2 text-[10px] font-medium leading-snug text-slate-700 dark:text-slate-200">
                      {c.title}
                    </p>
                    <p className="mt-1 truncate font-mono text-[8px] text-slate-400">{c.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --------------------------------- Страница ---------------------------------

export function DemoJourney() {
  return (
    <div className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6">
      {/* Заголовок */}
      <div className="text-center">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
          Демо на макетных данных
        </span>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Как работает Logsy: 7 шагов от подключения до починки
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Ниже — путь одного сбоя: что происходит у посетителя и что в этот момент
          видите вы. Всё на этой странице — демонстрация: ничего не отправляется и
          не сохраняется.
        </p>
      </div>

      <div className="mt-14 space-y-16">
        {/* Шаг 1. Подключение */}
        <section>
          <StepTitle n={1}>Вставляете одну строку в {"<head>"}</StepTitle>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-slate-600 dark:text-slate-400">
                Это всё подключение: без npm-пакетов, ключей и настройки — проект
                определяется по домену. Сбор ошибок, запросов и сессий включается
                сразу.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {["2 минуты на установку", "0 зависимостей", "Работает на любой CMS и конструкторе"].map(
                  (t) => (
                    <li key={t} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand">✓</span>
                      <span className="text-slate-600 dark:text-slate-300">{t}</span>
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-card">
              <div className="flex items-center gap-1.5 border-b border-slate-700/70 bg-slate-800/80 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 font-mono text-[10px] text-slate-400">index.html</span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-slate-300">
                <code>{`<script src="https://logsy.ru/api/logger/sdk" defer></script>`}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Шаг 2. Сбой у посетителя */}
        <section>
          <StepTitle n={2}>У посетителя ломается оплата</StepTitle>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
            <div className="md:order-2">
              <p className="text-slate-600 dark:text-slate-400">
                Сайт открывается, каталог работает — а кнопка оплаты возвращает
                ошибку. Посетитель уходит молча. Без Logsy этот момент никто бы не
                заметил: страница-то отвечает 200.
              </p>
            </div>
            <div className={`${cardCls} md:order-1`}>
              <BrowserBar url="example.ru/checkout" />
              <div className="space-y-2.5 p-4">
                <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-16 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-32 items-center justify-center rounded-lg bg-red-100 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    Ошибка оплаты
                  </div>
                  <span className="font-mono text-[10px] text-red-600">POST /api/pay → 500</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  13:42 · посетитель закрыл вкладку
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Шаг 3. Алерт */}
        <section>
          <StepTitle n={3}>Через 60 секунд вам приходит алерт</StepTitle>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-slate-600 dark:text-slate-400">
                Минутная проверка оплаты поймала тот же сбой. В сообщении сразу
                всё, что нужно для реакции: маршрут, код ответа, время.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {[
                  "Письмо и Telegram одновременно",
                  "Отдельное сообщение о восстановлении — виден срок простоя",
                  "История проверок как аргумент для хостинга и подрядчика",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <span className="mt-0.5 text-brand">✓</span>
                    <span className="text-slate-600 dark:text-slate-300">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={cardCls}>
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/60">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
                  L
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Logsy · Telegram
                </span>
                <span className="ml-auto text-[10px] text-slate-400">13:43</span>
              </div>
              <div className="p-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    🔴 Сбой: оплата недоступна
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-xs">
                    {[
                      ["Проект", "example.ru"],
                      ["Проверка", "POST /api/pay"],
                      ["Ответ", "500 · 2412 мс"],
                      ["Время", "13:43:07"],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-2">
                        <dt className="text-slate-500">{k}</dt>
                        <dd className="font-mono font-medium text-slate-700 dark:text-slate-200">
                          {v}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Шаг 4. Сессия и запись */}
        <section>
          <StepTitle n={4}>Открываете сессию — и смотрите её как видео</StepTitle>
          <div className="mt-6 grid items-start gap-8 md:grid-cols-2">
            <div className="md:order-2">
              <p className="text-slate-600 dark:text-slate-400">
                В сессии — весь путь посетителя до сбоя: переходы, клики, ввод,
                запросы. Нажмите play: запись воспроизводится как видео, метки на
                таймлайне перематывают прямо к ошибке.
              </p>
              {/* Лента событий той же сессии */}
              <ul className="mt-5 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/80 text-xs dark:divide-slate-800 dark:border-slate-700/70">
                {[
                  { t: "13:41:12", label: "Открыта страница /checkout", dot: "bg-blue-500" },
                  { t: "13:41:35", label: "Ввод: email = a•••@mail.ru", dot: "bg-slate-400" },
                  { t: "13:42:41", label: "Медленный запрос /api/checkout · 1240 мс", dot: "bg-amber-500" },
                  { t: "13:42:43", label: "HTTP 500 /api/pay", dot: "bg-red-500", hi: true },
                  { t: "13:42:58", label: "Выход с сайта · Отказ", dot: "bg-slate-400" },
                ].map((e) => (
                  <li
                    key={e.t}
                    className={`flex items-center gap-3 px-3 py-2 ${
                      e.hi ? "bg-red-50/60 font-medium dark:bg-red-950/20" : ""
                    }`}
                  >
                    <span className="w-14 shrink-0 font-mono text-[10px] text-slate-400">{e.t}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} />
                    <span className="flex-1 truncate text-slate-600 dark:text-slate-300">
                      {e.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:order-1">
              <ReplayPlayer />
            </div>
          </div>
        </section>

        {/* Шаг 5. Причина */}
        <section>
          <StepTitle n={5}>Причина перед глазами: файл, строка, запрос</StepTitle>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
            <div>
              <p className="text-slate-600 dark:text-slate-400">
                Не «что-то сломалось», а конкретика для починки: стектрейс ошибки
                и упавший запрос с телом. Это можно отдать разработчику — или
                ИИ-агенту через{" "}
                <Link href="/docs/api" className="text-brand hover:underline">
                  публичное API
                </Link>
                : он заберёт те же данные в JSON и починит по фактам.
              </p>
            </div>
            <div className={cardCls}>
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/70">
                <span className="flex items-center gap-2 text-xs font-semibold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Unhandled error
                </span>
                <span className="font-mono text-[10px] text-slate-400">Сессия #7042 · 13:42:43</span>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                    TypeError: cannot read &apos;total&apos; of undefined
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
{`at renderCart (checkout.js:142:19)
at onClick (checkout.js:88:7)`}
                  </pre>
                </div>
                <div className="rounded-lg border border-slate-200/80 p-3 dark:border-slate-700/70">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Упавший запрос
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="rounded bg-red-100 px-1.5 py-0.5 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                      500
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      POST
                    </span>
                    <span className="truncate text-slate-600 dark:text-slate-300">/api/pay</span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-400">
                    payload: {'{ items: 3, promo: "SALE30" }'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Шаг 6. Жалоба → задача (интерактив) */}
        <section>
          <StepTitle n={6}>Жалобы клиентов сами становятся задачами</StepTitle>
          <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-400">
            Пока вы чините, посетители жмут кнопку «Сообщить об ошибке» на сайте.
            Сообщение попадает в сессию автора и на доску задач. Попробуйте сами:
          </p>
          <div className="mt-6">
            <FeedbackToTask />
          </div>
        </section>

        {/* Шаг 7. Итог */}
        <section>
          <StepTitle n={7}>Починили — и видите, что починили</StepTitle>
          <div className="mt-6 grid items-center gap-8 md:grid-cols-2">
            <div className="md:order-2">
              <p className="text-slate-600 dark:text-slate-400">
                Проверка сама сообщает о восстановлении и называет срок простоя. В
                новых сессиях ошибки больше не появляются — исправление
                подтверждают реальные посетители, а не «вроде работает».
              </p>
            </div>
            <div className={`${cardCls} md:order-1`}>
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    🟢 Восстановлено · простой 6 минут
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    POST /api/pay снова отвечает 200.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2.5 text-xs dark:border-slate-700/70">
                  <span className="text-slate-500">Ошибок в сессиях за последний час</span>
                  <span className="font-mono text-sm font-bold text-emerald-600">0</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 152-ФЗ: проверка сайта и документы — параллельная ценность сервиса */}
      <section className="mt-16 rounded-3xl bg-white/70 p-6 shadow-card backdrop-blur-xl backdrop-saturate-150 sm:p-8 dark:bg-slate-900/70">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              📋 152-ФЗ
            </span>
            <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
              Заодно проверим сайт по 152-ФЗ
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Бот обходит сайт и показывает списком, чего не хватает по закону «О
              персональных данных»: политики, галочек согласия в формах, реквизитов
              оператора, счётчиков до согласия. А панель помогает найденное закрыть:
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {[
                "Политика, оферта и текст согласия генерируются по вашим реквизитам и живут по постоянной ссылке",
                "Скрипт встраивает галочку согласия прямо в формы сайта",
                "Каждое согласие пишется в журнал: страница, версия документа, время",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  <span className="text-slate-600 dark:text-slate-300">{t}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/site-check"
                className="rounded-full bg-gradient-to-r from-brand to-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
              >
                Проверить свой сайт
              </Link>
              <span className="text-xs text-slate-500">
                Техническая проверка, не юридическое заключение
              </span>
            </div>
          </div>

          {/* «Скриншот»: отчёт проверки 152-ФЗ */}
          <div className={cardCls}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-2.5 dark:border-slate-700/70">
              <span className="text-xs font-semibold text-slate-500">
                Проверка 152-ФЗ · example.ru
              </span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                6 из 10
              </span>
            </div>
            <ul className="divide-y divide-slate-100 text-xs dark:divide-slate-800">
              {[
                { ok: true, label: "Политика конфиденциальности найдена", norm: "ч. 2 ст. 18.1" },
                { ok: true, label: "Реквизиты оператора указаны", norm: "ст. 14" },
                { ok: false, label: "Нет галочки согласия в форме заказа", norm: "ст. 9" },
                { ok: false, label: "Счётчики ставятся до согласия", norm: "ст. 6" },
                { ok: false, label: "Шрифты грузятся с зарубежного сервиса", norm: "ст. 12" },
              ].map((r) => (
                <li key={r.label} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                      r.ok ? "bg-emerald-500" : "bg-red-500"
                    }`}
                  >
                    {r.ok ? "✓" : "!"}
                  </span>
                  <span className="flex-1 text-slate-600 dark:text-slate-300">{r.label}</span>
                  <span className="shrink-0 font-mono text-[9px] text-slate-400">{r.norm}</span>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-200/80 px-4 py-2.5 text-[11px] text-slate-400 dark:border-slate-700/70">
              3 замечания можно закрыть из панели: документы, галочка и журнал согласий.
            </div>
          </div>
        </div>
      </section>

      {/* Что осталось за кадром — кратко */}
      <section className="mt-10 rounded-3xl bg-white/70 p-6 shadow-card backdrop-blur-xl sm:p-8 dark:bg-slate-900/70">
        <h2 className="text-xl font-bold sm:text-2xl">Параллельно с этим Logsy следит за</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["🔒", "SSL-сертификатом", "Предупреждение за 7 дней, 3 дня, день и час до истечения."],
            ["🌐", "Сроком домена", "Напоминания за 30, 14, 7, 3 и 1 день до окончания регистрации."],
            ["🤖", "Данными для ИИ-агента", "Сессии и ошибки в JSON по ключу проекта — агент чинит по фактам."],
          ].map(([icon, t, s]) => (
            <div
              key={t}
              className="rounded-2xl border border-slate-200/70 bg-white/70 p-4 dark:border-slate-700/60 dark:bg-white/5"
            >
              <div className="text-2xl">{icon}</div>
              <h3 className="mt-2 text-sm font-semibold">{t}</h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{s}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-10 text-center">
        <h2 className="text-2xl font-bold sm:text-3xl">
          Пройдите этот путь на своём сайте
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
          Шаг 1 занимает две минуты. 300 сессий в сутки — бесплатно навсегда, без
          карты.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-block rounded-full bg-gradient-to-r from-brand to-brand-light px-8 py-3.5 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
        >
          Начать бесплатно
        </Link>
      </section>
    </div>
  );
}
