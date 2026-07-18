import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { FREE_SESSIONS_PER_DAY } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Logsy для маркетологов — не сливайте рекламный бюджет на ошибки",
  description:
    "Смотрите записи сессий, где лиды упираются в ошибку формы, видите UTM и путь до отказа. Спасайте конверсию и бюджет. Старт бесплатно.",
};

// Ключевые цифры оффера для маркетологов.
const stats = [
  { value: "1 из 5", label: "визитов с рекламы упирается в баг или тормоз" },
  { value: "UTM", label: "видите источник и кампанию каждой сессии" },
  { value: "≈0 ₽", label: "сохранённого бюджета за пойманный отвал формы" },
  { value: "60 сек", label: "и вы знаете, что лендинг снова упал" },
];

// Боль маркетолога: слитый бюджет, отвал формы, конверсия.
const pains = [
  {
    icon: "🔥",
    title: "Бюджет горит в никуда",
    text: "Вы льёте платный трафик на лендинг, а форма заявки молча не отправляется на части устройств. Клики есть, лидов нет — а вы вините креатив.",
  },
  {
    icon: "📉",
    title: "Конверсия просела — а почему?",
    text: "Метрика показывает падение конверсии, но не показывает, что именно сломалось. Вы гадаете по цифрам вместо того, чтобы увидеть путь клиента.",
  },
  {
    icon: "🕳️",
    title: "Дыра в воронке невидима",
    text: "Между «перешёл по рекламе» и «оставил заявку» пользователи отваливаются пачками. Без записи сессий шаг, где вы теряете деньги, не найти.",
  },
];

// Что получает маркетолог.
const benefits = [
  {
    icon: "🎬",
    title: "Видео каждой сессии с рекламы",
    text: "Смотрите глазами пользователя весь путь от клика по объявлению до отказа. Видно, на каком шаге воронки и из-за чего сгорает бюджет.",
  },
  {
    icon: "🎯",
    title: "UTM и источник в каждой сессии",
    text: "Каждая запись помечена меткой перехода и страной. Сразу видно, какая кампания приводит трафик, который упирается в ошибку.",
  },
  {
    icon: "🚨",
    title: "Отвал формы виден сразу",
    text: "Ошибка отправки заявки, упавший скрипт квиза, битый шаг оплаты — попадают в ленту событий и алерт. Чините до того, как открутите весь бюджет.",
  },
];

export default async function ForMarketersPage() {
  const session = await auth();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-indigo-300/20 blur-3xl"
      />

      <LandingNav authed={!!session} />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
          📈 Для маркетологов и владельцев трафика
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Вы платите за клик, а лид{" "}
          <span className="bg-gradient-to-r from-brand to-indigo-500 bg-clip-text text-transparent">
            тонет в ошибке
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Logsy показывает записи сессий с рекламы: видно, на каком шаге воронки
          и из-за какого бага пользователь уходит. Спасайте конверсию и бюджет,
          а не гадайте по метрике.
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
          {FREE_SESSIONS_PER_DAY} записей сессий в сутки — бесплатно. Без карты.
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
            Трафик есть, а заявок нет — и непонятно почему
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

      {/* Скриншот выгоды: сессия с UTM и точкой отвала */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="md:order-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
              🧭 Путь клиента с рекламы
            </span>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Видно, где именно сгорел лид
            </h3>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              Каждая сессия помечена UTM-источником и страной. В ленте событий —
              весь путь от перехода по объявлению до момента, где форма не
              отправилась и пользователь ушёл.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[
                "Метка кампании (UTM) и гео у каждой сессии",
                "Точка отвала: где форма упала и клиент закрыл вкладку",
                "Аналитика отказов — какая кампания приводит битый трафик",
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

          {/* «Скриншот»: карточка сессии с UTM и отвалом на форме */}
          <div className="md:order-1">
            <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">🇷🇺</span>
                  <span className="font-mono text-xs text-slate-500">
                    Сессия #7042
                  </span>
                </div>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand dark:bg-brand/10">
                  utm: yandex / cpc
                </span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  { t: "10:14:02", label: "Переход с рекламы «Скидка 30%»", dot: "bg-brand" },
                  { t: "10:14:03", label: "Открыт лендинг /promo", dot: "bg-blue-500" },
                  { t: "10:14:31", label: "Клик: «Оставить заявку»", dot: "bg-slate-400" },
                  { t: "10:14:44", label: "Ввод: телефон +7 •••", dot: "bg-slate-400" },
                  { t: "10:14:52", label: "Ошибка отправки формы", dot: "bg-red-500", badge: "не ушла", badgeCls: "bg-red-100 text-red-700", hi: true },
                  { t: "10:15:05", label: "Уход со страницы", dot: "bg-slate-400", badge: "Отказ", badgeCls: "bg-slate-200 text-slate-600" },
                ].map((e, i) => (
                  <li
                    key={i}
                    className={`flex items-center gap-3 px-4 py-2.5 ${
                      e.hi ? "bg-red-50/60 dark:bg-red-950/20" : ""
                    }`}
                  >
                    <span className="w-12 shrink-0 font-mono text-[10px] text-slate-400">
                      {e.t}
                    </span>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.dot}`} />
                    <span className="flex-1 truncate text-xs text-slate-600 dark:text-slate-300">
                      {e.label}
                    </span>
                    {e.badge && (
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${e.badgeCls}`}
                      >
                        {e.badge}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-center text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40">
                Лид с оплаченного клика потерян на шаге формы
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
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-indigo-500 p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/85 p-8 text-center backdrop-blur-xl sm:p-12 dark:bg-slate-900/85">
            <h2 className="text-3xl font-bold sm:text-4xl">
              Хватит платить за трафик, который не конвертит
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
              Подключите Logsy к лендингу за минуту и увидьте первую запись
              сессии уже сегодня. Бесплатно навсегда.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-block rounded-xl bg-gradient-to-r from-brand to-indigo-500 px-8 py-3.5 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
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
