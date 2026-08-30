import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { FREE_SESSIONS_PER_DAY } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Мониторинг сайта для владельцев бизнеса — не теряйте заказы",
  description:
    "Узнавайте о падении оплаты, авторизации и сайта за 60 секунд, а не из жалоб клиентов. Проверки каждую минуту, алерты на почту и в Telegram. Бесплатно.",
};

// Ключевые цифры оффера для владельцев онлайн-сайтов и магазинов.
const stats = [
  { value: "60 сек", label: "узнаёте о сбое, а не через часы из жалоб" },
  { value: "1 мин", label: "интервал проверки оплаты и авторизации" },
  { value: "24/7", label: "следим за сайтом без выходных и ночей" },
  { value: "0 ₽", label: "старт бесплатно, без карты и договора" },
];

// Боль владельца: цифры про потерянную выручку и клиентов.
const pains = [
  {
    icon: "💳",
    title: "Оплата молча отвалилась",
    text: "Платёжный шлюз вернул ошибку, а вы узнаёте об этом вечером по пустым продажам. Все заказы за эти часы ушли вместе с деньгами, потраченными на рекламу.",
  },
  {
    icon: "🚪",
    title: "Клиент ушёл и не вернулся",
    text: "Посетитель, упёршийся в ошибку, не пробует второй раз — он открывает конкурента из той же выдачи. Вы заплатили за этот клик и потеряли его молча.",
  },
  {
    icon: "🕐",
    title: "«У нас всё работает»",
    text: "Сайт открывается у вас, но падает у клиента на его браузере и его сети. Без записи сессии вы спорите с покупателем вслепую.",
  },
];

// Что получает владелец — с конкретикой по деньгам и заказам.
const benefits = [
  {
    icon: "✅",
    title: "Оплата и вход — под контролем каждую минуту",
    text: "Проверяем реальный сценарий покупки: оплату, авторизацию, ключевые API — с телом запроса и нужным кодом ответа. Сломалось — письмо и Telegram за 60 секунд.",
  },
  {
    icon: "🎬",
    title: "Видео сессии вместо споров с клиентом",
    text: "Смотрите, что покупатель видел и куда нажимал перед тем, как бросить корзину. Ошибки и тормоза отмечены прямо на таймлайне — перематываете к моменту сбоя.",
  },
  {
    icon: "💬",
    title: "Клиент сам жалуется — в один клик",
    text: "Кнопка «Сообщить об ошибке» на сайте: посетитель опишет проблему, а вы увидите её в контексте всей его сессии и почините раньше, чем потеряете продажи.",
  },
];

export default async function ForOwnersPage() {
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
          🛍️ Для владельцев онлайн-сайтов и магазинов
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Каждая минута простоя{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            стоит вам заказов
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Logsy проверяет оплату, вход и сайт каждую минуту и сообщает о сбое за
          60 секунд — на почту и в Telegram. Вы чините раньше, чем клиент
          заметит и уйдёт.
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
          Бесплатно навсегда: {FREE_SESSIONS_PER_DAY} сессий в сутки. Без карты и
          договора.
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

      {/* Боль */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-14">
        <div className="text-center">
          <span className="inline-block rounded-full bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Знакомо?
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Вы платите за трафик, а теряете его на сбоях
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

      {/* Скриншот выгоды: алерт о падении оплаты */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              ✉️ Мгновенный алерт
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Узнаёте о сбое первым, а не из отзыва
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Как только оплата или вход перестали отвечать, Logsy присылает
              письмо и сообщение в Telegram с точным маршрутом, кодом ответа и
              временем. Вы реагируете за минуты, а не за смену.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Точный маршрут и код ответа — сразу понятно, что чинить",
                "Уведомление на почту и в Telegram одновременно",
                "Повторный алерт, когда всё снова заработало",
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

          {/* «Скриншот»: пуш о сбое оплаты */}
          <div className="mx-auto w-full max-w-md">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-200/80 bg-slate-50 px-4 py-2.5 dark:border-slate-700/70 dark:bg-slate-800/60">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-xs font-bold text-white">
                  L
                </span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Logsy · Telegram
                </span>
                <span className="ml-auto text-[10px] text-slate-400">
                  14:03
                </span>
              </div>
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-red-700 dark:text-red-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    🔴 Сбой: оплата недоступна
                  </div>
                  <dl className="mt-2.5 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Проект</dt>
                      <dd className="font-medium text-slate-700 dark:text-slate-200">
                        example.ru
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Проверка</dt>
                      <dd className="font-mono text-slate-700 dark:text-slate-200">
                        POST /api/pay
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Ответ</dt>
                      <dd className="font-mono font-semibold text-red-600">
                        500 · 2412 мс
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">Время</dt>
                      <dd className="text-slate-700 dark:text-slate-200">
                        18.07 14:03:07
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    🟢 Восстановлено · через 6 мин
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    POST /api/pay снова отвечает 200. Простой — 6 минут.
                  </p>
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
              Перестаньте терять заказы вслепую
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              Подключение — одна строка в{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm dark:bg-slate-800">
                &lt;head&gt;
              </code>{" "}
              и пара минут на первую проверку. Бесплатно навсегда.
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
