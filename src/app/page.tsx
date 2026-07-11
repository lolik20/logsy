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
    <main className="min-h-screen">
      {/* Навбар */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="text-2xl font-bold text-brand">Logsy</div>
        <nav className="flex items-center gap-3">
          {session ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Панель управления
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:text-brand dark:text-slate-200"
              >
                Войти
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
              >
                Начать
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-12 text-center">
        <span className="inline-block rounded-full bg-brand/10 px-4 py-1 text-sm font-medium text-brand">
          Мониторинг доступности сайтов и API
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Узнавайте о падении сайта{" "}
          <span className="text-brand">раньше клиентов</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Logsy проверяет ваши сайты и API каждую минуту и сразу присылает
          письмо, если что-то пошло не так. Настройка за пару минут.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            href="/register"
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-white shadow-lg shadow-brand/30 hover:bg-brand-dark"
          >
            Попробовать бесплатно
          </Link>
          <Link
            href="#pricing"
            className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-200"
          >
            Тарифы
          </Link>
        </div>
      </section>

      {/* Фичи */}
      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Тарифы */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Простой тариф</h2>
        <p className="mt-3 text-center text-slate-600 dark:text-slate-400">
          Платите только за то, что мониторите.
        </p>
        <div className="mx-auto mt-10 max-w-md rounded-3xl border-2 border-brand bg-white p-8 shadow-xl dark:bg-slate-900">
          <div className="text-center">
            <div className="text-sm font-semibold uppercase tracking-wide text-brand">
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
            className="mt-8 block rounded-lg bg-brand px-6 py-3 text-center font-semibold text-white hover:bg-brand-dark"
          >
            Подключить
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        © {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.
      </footer>
    </main>
  );
}
