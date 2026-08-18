import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";

export const metadata: Metadata = {
  title: "Логи и запись сессий для разработчиков — баги прода без гаданий",
  description:
    "Стектрейсы фронт-ошибок, упавшие 4xx/5xx с payload, запись сессии и медленные запросы. Одна строка в <head>, 0 зависимостей, батчинг раз в 10 сек.",
};

// Ключевые цифры оффера для программистов.
const stats = [
  { value: "1 строка", label: "тег в <head> — без ключей и зависимостей" },
  { value: "0 npm", label: "пакетов ставить не нужно, автозапуск" },
  { value: "10 сек", label: "батчинг событий — ноль нагрузки на сайт" },
  { value: "4xx/5xx", label: "упавшие запросы с методом, payload и кодом" },
];

// Боль разработчика: невоспроизводимые баги.
const pains = [
  {
    icon: "🐛",
    title: "«У меня не воспроизводится»",
    text: "Пользователь прислал скрин с ошибкой, а на вашей машине всё зелёное. Без стектрейса и контекста сессии вы чините вслепую по пересказу.",
  },
  {
    icon: "🔌",
    title: "Фронт молчит про упавший бэкенд",
    text: "API вернул 500, фронт проглотил ошибку, пользователь увидел белый экран. В консоли пусто, в логах сервера — тоже не всё видно.",
  },
  {
    icon: "🐢",
    title: "«Тормозит» — но где именно?",
    text: "Жалоба на медленную страницу без цифр. Какой запрос, какой файл, сколько миллисекунд — без замеров это спор, а не задача.",
  },
];

// Что получает разработчик.
const benefits = [
  {
    icon: "🐞",
    title: "Стектрейсы фронт-ошибок из прода",
    text: "Ловим необработанные исключения и отклонённые промисы со стеком — видно файл, строку и что произошло у реального пользователя.",
  },
  {
    icon: "🔌",
    title: "Упавшие запросы с payload",
    text: "Каждый 4xx/5xx с маршрутом, методом, телом запроса и кодом ответа. Сразу понятно, фронт или бэкенд, и на каких данных упало.",
  },
  {
    icon: "🎬",
    title: "Запись сессии = repro-шаги",
    text: "Воспроизведение экрана как видео с метками ошибок и тормозов на таймлайне. Готовые шаги воспроизведения без переписки с пользователем.",
  },
];

export default async function ForDevelopersPage() {
  const session = await auth();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-sky-400/20 blur-3xl"
      />

      <LandingNav authed={!!session} />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
          👩‍💻 Для программистов и техлидов
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Воспроизводите баги прода —{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            а не гадайте по скрину
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Стектрейсы фронт-ошибок, упавшие 4xx/5xx с payload, запись сессии и
          медленные запросы. Подключение — одна строка в{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-base dark:bg-slate-800">
            &lt;head&gt;
          </code>
          , без зависимостей.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
          >
            Начать бесплатно
          </Link>
          <Link
            href="/#pricing"
            className="rounded-xl border border-white/50 bg-white/60 px-6 py-3 font-semibold text-slate-700 backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:text-brand dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            Тарифы
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-500">
          Без карты. Данные хранятся в РФ, пароли и карты маскируются на клиенте.
        </p>
      </section>

      {/* Цифры */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/50 bg-white/60 p-6 text-center shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className="text-3xl font-extrabold text-brand sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Установка в одну строку — «скриншот» кода */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              ⚡ Установка за минуту
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Один тег — и логирование в проде
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Никаких npm-пакетов, ключей и сборки. Вставляете тег в{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-sm dark:bg-slate-800">
                &lt;head&gt;
              </code>{" "}
              — SDK запускается сам, собирает события и шлёт их батчами раз в 10
              секунд.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Ноль зависимостей и ноль конфигурации по умолчанию",
                "Умный батчинг — минимальная нагрузка на страницу",
                "Проект определяется по Origin — без ручных ключей",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* «Скриншот»: окно редактора с тегом */}
          <div className="mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-900 shadow-card">
              <div className="flex items-center gap-1.5 border-b border-slate-700/70 bg-slate-800/80 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                <span className="ml-2 font-mono text-[10px] text-slate-400">
                  index.html
                </span>
              </div>
              <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-slate-300">
                <code>
                  <span className="text-slate-500">{"<head>"}</span>
                  {"\n  "}
                  <span className="text-slate-500">{"<title>"}</span>
                  <span className="text-slate-400">Мой сайт</span>
                  <span className="text-slate-500">{"</title>"}</span>
                  {"\n\n  "}
                  <span className="text-slate-500">{"<!-- Logsy -->"}</span>
                  {"\n  "}
                  <span className="text-sky-400">{"<script"}</span>{" "}
                  <span className="text-emerald-400">src</span>=
                  <span className="text-amber-300">
                    &quot;https://logsy.ru/api/logger/sdk&quot;
                  </span>{" "}
                  <span className="text-emerald-400">async</span>
                  <span className="text-sky-400">{"></script>"}</span>
                  {"\n"}
                  <span className="text-slate-500">{"</head>"}</span>
                </code>
              </pre>
              <div className="flex items-center gap-2 border-t border-slate-700/70 bg-slate-800/60 px-4 py-2.5 text-[11px]">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  SDK активен
                </span>
                <span className="text-slate-500">· события идут батчами</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Боль */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <div className="text-center">
          <span className="inline-block rounded-full bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Знакомо?
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Баг в проде есть, а данных для фикса — нет
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {pains.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/50 bg-white/60 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-2xl dark:bg-red-950/40">
                {p.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {p.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Скриншот выгоды: стектрейс ошибки */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="md:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              🐞 Ошибка с контекстом
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Стектрейс, запрос и сессия — в одном месте
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Не просто «TypeError», а файл, строка, упавший запрос с телом и
              кодом ответа, привязанные к сессии пользователя. Открываете и
              чините, а не восстанавливаете контекст по переписке.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Необработанные исключения и отклонённые промисы со стеком",
                "Упавшие 4xx/5xx: маршрут, метод, payload, код ответа",
                "Медленные запросы дороже порога — с таймингами в мс",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-brand">✓</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* «Скриншот»: карточка ошибки со стектрейсом */}
          <div className="md:order-1">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                <span className="flex items-center gap-2 text-xs font-semibold text-red-600">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Unhandled error
                </span>
                <span className="font-mono text-[10px] text-slate-400">
                  Сессия #4805 · 14:02:43
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
                    TypeError: cannot read &apos;total&apos; of undefined
                  </p>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
{`at renderCart (checkout.js:142:19)
at onClick (checkout.js:88:7)
at HTMLButtonElement.dispatch`}
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
                    <span className="truncate text-slate-600 dark:text-slate-300">
                      /api/cart/total
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[11px] text-slate-400">
                    payload: {"{ items: 3, promo: \"SALE30\" }"}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                    🐢 1240 мс
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-800">
                    Chrome 126 · Windows
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Выгоды */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur-md dark:border-white/10 dark:bg-white/5"
            >
              <div className="text-3xl">{b.icon}</div>
              <h3 className="mt-3 text-lg font-semibold">{b.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {b.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Финальный CTA */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-sky-500 p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/85 p-8 text-center backdrop-blur-xl sm:p-12 dark:bg-slate-900/85">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Хватит чинить баги по пересказу
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              Вставьте одну строку в{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm dark:bg-slate-800">
                &lt;head&gt;
              </code>{" "}
              и получите стектрейсы, запросы и записи сессий из прода. Бесплатно
              навсегда.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-light px-8 py-3.5 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
            >
              Начать бесплатно
            </Link>
          </div>
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
