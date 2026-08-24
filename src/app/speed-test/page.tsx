import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { SpeedTestForm } from "@/components/SpeedTestForm";

export const metadata: Metadata = {
  title: "Проверить скорость загрузки сайта онлайн бесплатно",
  description:
    "Бесплатный онлайн-инструмент: узнайте скорость загрузки сайта по URL — время до первого байта, полное время загрузки и размер ответа. А Logsy покажет, что происходит после загрузки: подробное логирование сессий и запись экрана пользователей.",
};

const steps = [
  {
    title: "Грузим страницу целиком",
    text: "Не просто пингуем — скачиваем HTML и все подключённые скрипты, стили и картинки, как это делает браузер.",
    icon: "🌐",
  },
  {
    title: "Готовность DOM со скриптами",
    text: "Замеряем время, пока страница разберётся и подгрузятся все скрипты — момент, когда она готова к работе.",
    icon: "⚡",
  },
  {
    title: "TTFB, запросы и полная загрузка",
    text: "Показываем первый байт, число запросов и полное время загрузки — сразу видно, что тормозит.",
    icon: "⏱️",
  },
];

export default async function SpeedTestPage() {
  const session = await auth();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Парящие градиентные пятна на фоне */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-sky-400/20 blur-3xl"
      />

      <LandingNav authed={!!session} />

      {/* Hero + инструмент */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-16 pt-16">
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
            Бесплатный онлайн-инструмент
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Ваш сайт{" "}
            <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
              тормозит
            </span>
            ? Проверьте за 5 секунд
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Медленный сайт молча теряет клиентов и деньги. Введите адрес — покажем
            реальную скорость загрузки и сколько ждёт ваш посетитель.
          </p>
        </div>

        <div className="mt-10">
          <SpeedTestForm />
        </div>
      </section>

      {/* Что мы измеряем */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/50 bg-white/60 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-2xl dark:from-brand/20 dark:to-brand/10">
                {s.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Мост: скорость — только симптом, Logsy показывает причину */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-4 text-center">
        <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
          Скорость — это только начало
        </span>
        <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold sm:text-4xl">
          Тест покажет{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            симптом
          </span>
          . Logsy покажет причину
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-300">
          Цифры загрузки говорят «медленно», но не говорят «почему» и «у кого».
          Logsy пишет подробный лог каждой сессии и снимает запись экрана — вы
          видите ровно то, что видел посетитель перед уходом.
        </p>
      </section>

      {/* Подробное логирование сессий */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          {/* Текст (на десктопе — справа) */}
          <div className="md:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              🧭 Логирование сессий
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Подробный лог каждой сессии
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Весь путь посетителя — переходы, клики, ввод, запросы и ошибки — в
              единой ленте по времени. Медленный тест внизу превращается в
              конкретный запрос, который тормозит, и в конкретный шаг, на котором
              уходят клиенты.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Хронология событий: переходы, клики, ввод, запросы и ошибки",
                "Медленные запросы и упавшие 4xx/5xx — с маршрутом, методом и кодом ответа",
                "Группировка по пользователю и IP, страна по гео, метки перехода (UTM)",
                "«Крошки» перед уходом — видно, где именно теряются клиенты",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  <span className="text-slate-600 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* «Скриншот»: карточка сессии с лентой событий (на десктопе — слева) */}
          <div className="md:order-1">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">🇷🇺</span>
                  <span className="font-mono text-xs text-slate-500">IP 91.108.44.12</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-red-600">
                    <span className="h-2 w-2 rounded-full bg-red-500" />1
                  </span>
                  <span className="flex items-center gap-1 text-amber-500">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />1
                  </span>
                </div>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { t: "14:02:11", label: "Начало сессии", dot: "bg-emerald-500" },
                  { t: "14:02:12", label: "Открыта страница /catalog", dot: "bg-blue-500" },
                  { t: "14:02:20", label: "Клик: «Добавить в корзину»", dot: "bg-slate-400" },
                  { t: "14:02:35", label: "Ввод: email = a•••@mail.ru", dot: "bg-slate-400" },
                  { t: "14:02:41", label: "Медленный запрос /api/checkout", dot: "bg-amber-500", badge: "1240 мс", badgeCls: "bg-amber-100 text-amber-700" },
                  { t: "14:02:43", label: "HTTP 500 /api/pay", dot: "bg-red-500", badge: "ошибка", badgeCls: "bg-red-100 text-red-700", hi: true },
                  { t: "14:02:58", label: "Выход с сайта", dot: "bg-slate-400", badge: "Отказ", badgeCls: "bg-slate-200 text-slate-600" },
                ].map((e, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      e.hi ? "bg-red-50/60 dark:bg-red-950/20" : ""
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-[10px] text-slate-400">{e.t}</span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} />
                    <span className="flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                      {e.label}
                    </span>
                    {e.badge && (
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${e.badgeCls}`}>
                        {e.badge}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Запись экрана сессий */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          {/* Текст (на десктопе — слева) */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              🎬 Запись экрана
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Смотрите сессию как видео
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Logsy пишет действия посетителя — клики, ввод, прокрутку, навигацию —
              и воспроизводит их как запись с таймлайном. Не гадайте, что пошло не
              так: перемотайте к моменту ошибки и увидите всё своими глазами.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Воспроизведение с таймлайном, паузой и перемоткой к ошибке",
                "Пароли и значения полей маскируются, data-logsy-mask скрывает элементы полностью",
                "Работает на ПК и мобильных, привязано к той же сессии и её событиям",
                "Запись грузится по кнопке — ноль лишней нагрузки на страницу",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  <span className="text-slate-600 dark:text-slate-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* «Скриншот»: плеер записи экрана в окне браузера */}
          <div className="relative mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
              {/* Верхняя панель браузера */}
              <div className="flex items-center gap-1.5 border-b border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/60">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900">
                  example.ru/checkout
                </span>
                <span className="flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  REC
                </span>
              </div>
              {/* «Кадр» записи */}
              <div className="relative bg-white p-4 dark:bg-slate-900">
                <div className="space-y-2.5">
                  <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-2.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-24 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-28 rounded-lg bg-brand/20" />
                    {/* Курсор посетителя над кнопкой */}
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-slate-700 dark:text-slate-200"
                      fill="currentColor"
                    >
                      <path d="M4 2l7 18 2.5-7L20 10 4 2z" />
                    </svg>
                  </div>
                  <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
              {/* Управление плеером: play + таймлайн с меткой ошибки */}
              <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <div className="relative h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                    <span className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-brand" />
                    <span className="absolute left-2/3 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow" />
                    {/* Метка ошибки на таймлайне */}
                    <span
                      className="absolute top-1/2 h-3 w-1 -translate-y-1/2 rounded-full bg-red-500"
                      style={{ left: "82%" }}
                      title="HTTP 500 /api/pay"
                    />
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">0:32 / 0:47</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Мини-грид ценности + CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "Симптом → причина", s: "Медленный тест — это цифра. Лог сессии показывает, какой запрос и на каком шаге тормозит.", icon: "🔎" },
            { t: "Видно глазами клиента", s: "Запись экрана воспроизводит сессию как видео — вы смотрите ровно то, что видел посетитель.", icon: "🎬" },
            { t: "Приватность по умолчанию", s: "Пароли и поля маскируются, data-logsy-mask скрывает чувствительное полностью.", icon: "🛡️" },
            { t: "Установка за минуту", s: "Одна строка в <head>, без ключей и зависимостей. Работает на ПК и мобильных.", icon: "⚡" },
          ].map((f) => (
            <div
              key={f.t}
              className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-2xl">{f.icon}</div>
              <h3 className="mt-3 text-base font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{f.s}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className="inline-block rounded-xl bg-gradient-to-r from-brand to-sky-500 px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
          >
            Подключить логирование и запись
          </Link>
          <p className="mt-3 text-sm text-slate-500">
            Бесплатный тариф навсегда — начните с сессий и записи экрана уже сегодня.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        <p>© {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.</p>
      </footer>
    </main>
  );
}
