import Link from "next/link";
import { auth } from "@/lib/auth";

const features = [
  {
    title: "Мониторинг каждую минуту",
    text: "Проверяем ваши эндпоинты с периодичностью 1 минута, 1 час или 1 день — выбираете вы.",
    icon: "⏱️",
  },
  {
    title: "Любые HTTP-методы",
    text: "GET, POST, PUT, DELETE и настраиваемый ожидаемый код ответа для точной проверки API.",
    icon: "🌐",
  },
  {
    title: "Алерты на почту",
    text: "Как только сайт или API упал — мгновенно отправляем письмо на ваши контакты.",
    icon: "✉️",
  },
  {
    title: "Проекты и мониторы",
    text: "Группируйте мониторы по проектам (доменам). Вся история проверок под рукой.",
    icon: "📊",
  },
  {
    title: "Вход через Яндекс ID",
    text: "Авторизация через Яндекс ID или по почте — пароль придёт вам на email.",
    icon: "🔐",
  },
  {
    title: "Российский сервис",
    text: "Оплата в рублях, поддержка на русском, данные под рукой. Сделано для РФ рынка.",
    icon: "🇷🇺",
  },
];

export default async function LandingPage() {
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
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/2 h-80 w-[36rem] -translate-x-1/2 rounded-full bg-indigo-300/20 blur-3xl"
      />

      {/* Навбар — стеклянный, липкий */}
      <header className="sticky top-0 z-30 mx-auto flex max-w-6xl items-center justify-between rounded-b-2xl border-b border-white/40 bg-white/60 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-base font-bold text-white shadow-card">
            L
          </span>
          <span className="text-2xl font-bold text-slate-900 dark:text-white">
            Logsy
          </span>
        </div>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Панель управления
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:text-brand dark:text-slate-200"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-dark"
              >
                Начать
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-4 py-1.5 text-sm font-medium text-brand backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Мониторинг доступности сайтов и API
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Узнавайте о падении сайта{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            раньше клиентов
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Logsy проверяет ваши сайты и API каждую минуту и сразу присылает
          письмо, если что-то пошло не так. Настройка за пару минут.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
          >
            Попробовать бесплатно
          </Link>
          <Link
            href="#pricing"
            className="rounded-xl border border-white/50 bg-white/60 px-6 py-3 font-semibold text-slate-700 backdrop-blur-md transition-transform hover:-translate-y-0.5 hover:text-brand dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
          >
            Тарифы
          </Link>
        </div>

        {/* Парящая стеклянная карточка-превью статусов */}
        <div className="mx-auto mt-14 max-w-3xl rounded-3xl border border-white/50 bg-white/60 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: "shop.example.ru", status: "Работает", color: "text-green-600", dot: "bg-green-500", ms: "128 мс" },
              { name: "api.example.ru", status: "Работает", color: "text-green-600", dot: "bg-green-500", ms: "94 мс" },
              { name: "checkout", status: "Недоступен", color: "text-red-600", dot: "bg-red-500", ms: "500" },
            ].map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-white/60 bg-white/70 p-4 text-left backdrop-blur-md dark:border-white/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  <span className={`text-sm font-medium ${s.color}`}>{s.status}</span>
                </div>
                <div className="mt-2 truncate font-mono text-xs text-slate-500">{s.name}</div>
                <div className="mt-1 text-xs text-slate-400">{s.ms}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Фичи */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-white/50 bg-white/60 p-6 shadow-card backdrop-blur-xl transition-transform duration-200 hover:-translate-y-1.5 dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-2xl dark:from-brand/20 dark:to-brand/10">
                {f.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Тарифы */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Простой тариф</h2>
        <p className="mt-3 text-center text-slate-600 dark:text-slate-400">
          Платите только за то, что мониторите.
        </p>
        <div className="mx-auto mt-10 max-w-md rounded-3xl bg-gradient-to-br from-brand to-sky-500 p-[1.5px] shadow-card transition-transform hover:-translate-y-1">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/80 p-8 backdrop-blur-xl dark:bg-slate-900/80">
            <div className="text-center">
              <div className="inline-block rounded-full bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-sm font-semibold uppercase tracking-wide text-transparent">
                Pro
              </div>
              <div className="mt-4 flex items-baseline justify-center gap-1">
                <span className="text-5xl font-extrabold">300 ₽</span>
                <span className="text-slate-500">/ сайт в месяц</span>
              </div>
            </div>
            <ul className="mt-8 space-y-3 text-sm">
              {[
                "Неограниченное число мониторов на сайт",
                "Проверки каждую минуту (1м / 1ч / 1д)",
                "HTTP-методы GET, POST, PUT, DELETE",
                "Алерты на почту без задержек",
                "История проверок и статистика",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-brand">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-8 block rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 text-center font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
            >
              Подключить
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.
      </footer>
    </main>
  );
}
