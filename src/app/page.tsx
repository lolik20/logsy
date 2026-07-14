import Link from "next/link";
import { auth } from "@/lib/auth";
import { BILLING_PLANS, TIERS, tierPriceRub } from "@/lib/pricing";
import { LandingNav } from "@/components/LandingNav";

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
    title: "Контроль SSL-сертификата",
    text: "Следим за сроком действия SSL и предупреждаем письмом за неделю, за 3 дня, за 1 день и за 1 час до истечения — сайт не «покраснеет» в браузере неожиданно.",
    icon: "🔒",
  },
  {
    title: "Проверка оплаты и авторизации",
    text: "Мониторьте не только главную, но и критичные сценарии: оплату, вход, API — с телом запроса и заголовками.",
    icon: "🔐",
  },
  {
    title: "Российская локация",
    text: "Проверки из России, оплата в рублях, поддержка на русском. Данные остаются в РФ.",
    icon: "🇷🇺",
  },
];

const problems = [
  {
    title: "Не работает оплата на сайте",
    text: "Платёжный шлюз молча отвалился — заказы не проходят, а вы теряете деньги и не знаете об этом.",
    icon: "💳",
  },
  {
    title: "Отвалилась авторизация",
    text: "Пользователи не могут войти в личный кабинет. Об этом вы узнаёте последними — из жалоб.",
    icon: "🔒",
  },
  {
    title: "Клиенты уходят",
    text: "Каждая минута простоя — это потерянные клиенты, деньги и репутация. Молча и безвозвратно.",
    icon: "📉",
  },
];

// Сравнение с зарубежным конкурентом.
const comparison: { label: string; logsy: boolean; hetrix: boolean }[] = [
  { label: "Российская локация проверок", logsy: true, hetrix: false },
  { label: "Оплата в рублях", logsy: true, hetrix: false },
  { label: "Поддержка на русском", logsy: true, hetrix: false },
  { label: "Данные хранятся в РФ (152-ФЗ)", logsy: true, hetrix: false },
  { label: "Мониторинг API: методы, тело, заголовки", logsy: true, hetrix: true },
  { label: "Контроль срока SSL-сертификата", logsy: true, hetrix: true },
  { label: "Алерты на почту", logsy: true, hetrix: true },
  { label: "Проверки каждую минуту", logsy: true, hetrix: true },
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

      {/* Навбар со ссылками на разделы и бургером на мобильных */}
      <LandingNav authed={!!session} />

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16 pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/50 bg-white/60 px-4 py-1.5 text-sm font-medium text-brand backdrop-blur-md dark:border-white/10 dark:bg-white/5">
          <span className="h-2 w-2 animate-pulse rounded-full bg-brand" />
          Мониторинг доступности и логирование фронтенда
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Узнавайте о падении сайта{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            раньше клиентов
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Logsy проверяет ваши сайты и API каждую минуту и ловит ошибки фронтенда
          в проде — и сразу присылает письмо, если что-то пошло не так. Настройка
          за пару минут.
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
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          2 недели бесплатно на каждый проект · без привязки карты
        </p>

        {/* Парящая стеклянная карточка-превью статусов */}
        <div className="mx-auto mt-14 max-w-3xl rounded-3xl border border-white/50 bg-white/60 p-4 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: "shop.example.ru", status: "Работает", color: "text-green-600", dot: "bg-green-500", ms: "128 мс", ssl: "SSL: 82 дн.", sslColor: "text-green-600" },
              { name: "api.example.ru", status: "Работает", color: "text-green-600", dot: "bg-green-500", ms: "94 мс", ssl: "SSL истекает: 9 дн.", sslColor: "text-amber-600" },
              { name: "checkout", status: "Недоступен", color: "text-red-600", dot: "bg-red-500", ms: "500", ssl: "SSL: 41 дн.", sslColor: "text-green-600" },
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
                <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                  <span>{s.ms}</span>
                  <span className={`font-medium ${s.sslColor}`}>{s.ssl}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Проблемы */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <span className="inline-block rounded-full bg-red-50 px-4 py-1.5 text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-400">
            Знакомо?
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Сайт «лежит», а вы узнаёте последними
          </h2>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {problems.map((p) => (
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

      {/* Решение как сервис */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand to-sky-500 p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/80 p-8 backdrop-blur-xl sm:p-12 dark:bg-slate-900/80">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
                  Решение — Logsy как сервис
                </span>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Мы следим за вашим бизнесом 24/7
                </h2>
                <p className="mt-4 text-slate-600 dark:text-slate-300">
                  Logsy круглосуточно проверяет критичные сценарии — оплату,
                  авторизацию, ключевые API — из российской локации и мгновенно
                  шлёт письмо, как только что-то сломалось. Вы чините проблему
                  раньше, чем её заметят клиенты.
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-light px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
                >
                  Подключить мониторинг
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { t: "Оплата на сайте", s: "проверяем каждую минуту" },
                  { t: "Вход и авторизация", s: "API входа под контролем" },
                  { t: "Уведомление на почту", s: "мгновенно при сбое" },
                ].map((row) => (
                  <div
                    key={row.t}
                    className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/70 p-4 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600 dark:bg-green-950/50">
                      ✓
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{row.t}</div>
                      <div className="text-xs text-slate-500">{row.s}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Фичи */}
      <section id="features" className="relative z-10 mx-auto max-w-6xl px-6 py-12">
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

      {/* Логирование фронтенда — новое направление */}
      <section id="logging" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-brand p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/80 p-8 backdrop-blur-xl sm:p-12 dark:bg-slate-900/80">
            <div className="text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
                <span className="h-2 w-2 rounded-full bg-brand" />
                Новое · Логирование фронтенда
              </span>
              <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-bold sm:text-4xl">
                Видьте ошибки прода{" "}
                <span className="bg-gradient-to-r from-brand to-indigo-500 bg-clip-text text-transparent">
                  глазами пользователя
                </span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
                Один тег в <code className="font-mono text-sm">&lt;head&gt;</code> — и Logsy
                ловит JS-ошибки, упавшие и медленные запросы к вашему бэкенду и
                собирает всё в сессии пользователей. Без SDK, сборки и настройки.
              </p>
            </div>

            {/* Установка в одну строку */}
            <div className="mx-auto mt-8 max-w-2xl">
              <div className="rounded-2xl border border-slate-200/80 bg-slate-900 p-4 text-left dark:border-slate-700/70">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Подключение
                </div>
                <pre className="overflow-x-auto text-xs text-slate-100 sm:text-sm">
                  <code>&lt;script src=&quot;https://cdn.logsy.ru/logger.js&quot; async&gt;&lt;/script&gt;</code>
                </pre>
              </div>
              <p className="mt-2 text-center text-xs text-slate-500">
                Скрипт работает только с домена вашего проекта — чужой сайт его не
                запустит.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { t: "Фронт-ошибки", s: "Ловим необработанные исключения и отклонённые промисы со стеком.", icon: "🐞" },
                { t: "Ошибки бэкенда на фронте", s: "Видим упавшие 4xx/5xx запросы: маршрут, метод, payload, код ответа.", icon: "🔌" },
                { t: "Медленные запросы", s: "Отмечаем всё, что грузится дольше 500 мс — узкие места видны сразу.", icon: "🐢" },
                { t: "Сессии пользователей", s: "Все события группируются в сессию — виден весь путь до ошибки.", icon: "🧭" },
                { t: "Умный батчинг", s: "Собираем только критичное и шлём раз в 10 секунд — ноль нагрузки на сайт.", icon: "📦" },
                { t: "Установка за минуту", s: "Одна строка в <head>, без ключей и зависимостей. Автозапуск.", icon: "⚡" },
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
                className="inline-block rounded-xl bg-gradient-to-r from-brand to-indigo-500 px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
              >
                Подключить логирование
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Сравнение с конкурентом */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">Logsy или HetrixTools?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Зарубежные сервисы удобны, но у них нет российской локации и оплаты в
            рублях.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-slate-200/70 px-5 py-4 text-sm font-semibold sm:gap-x-8 sm:px-8 dark:border-slate-700/70">
            <div className="text-slate-500">Возможность</div>
            <div className="w-24 text-center text-brand">Logsy</div>
            <div className="w-24 text-center text-slate-400">HetrixTools</div>
          </div>
          {comparison.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-5 py-3.5 text-sm sm:gap-x-8 sm:px-8 ${
                i % 2 === 1 ? "bg-white/40 dark:bg-white/5" : ""
              }`}
            >
              <div className="font-medium">{row.label}</div>
              <div className="flex w-24 justify-center">
                {row.logsy ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-sm text-green-600 dark:bg-green-950/50">
                    ✓
                  </span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </div>
              <div className="flex w-24 justify-center">
                {row.hetrix ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-sm text-slate-500 dark:bg-slate-800">
                    ✓
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-sm text-red-500 dark:bg-red-950/40">
                    ✕
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Тарифы — за проект, три уровня */}
      <section id="pricing" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Тарифы — за проект</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-600 dark:text-slate-400">
          Один тариф на проект: uptime-мониторинг, логирование и алерты в каждом.
          Первые 2 недели — бесплатно, без карты. Скидка 10% за 3 месяца и 20% за год.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TIERS.map((t, idx) => {
            const highlighted = t.id === "T1000";
            return (
              <div
                key={t.id}
                className={`rounded-3xl p-[1.5px] shadow-card transition-transform hover:-translate-y-1 ${
                  highlighted
                    ? "bg-gradient-to-br from-brand to-indigo-500"
                    : "bg-white/50 dark:bg-white/10"
                }`}
              >
                <div className="flex h-full flex-col rounded-[calc(1.5rem-1.5px)] bg-white/85 p-7 backdrop-blur-xl dark:bg-slate-900/85">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase tracking-wide text-brand">
                      {t.name}
                    </span>
                    {highlighted && (
                      <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Популярный
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{t.monthlyRub} ₽</span>
                    <span className="text-slate-500">/ проект в месяц</span>
                  </div>
                  <div className="mt-2 text-sm font-medium text-slate-500">{t.sessionsLabel}</div>

                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {t.features.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <span className="text-brand">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Цена по периодам оплаты */}
                  <div className="mt-6 grid grid-cols-3 gap-2">
                    {BILLING_PLANS.map((p) => (
                      <div
                        key={p.id}
                        className="relative rounded-xl border border-slate-200/80 bg-white/70 p-2 text-center dark:border-slate-700/70 dark:bg-white/5"
                      >
                        {p.discountPercent > 0 && (
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                            −{p.discountPercent}%
                          </span>
                        )}
                        <div className="text-[10px] font-semibold text-slate-500">{p.label}</div>
                        <div className="mt-0.5 text-sm font-extrabold">{tierPriceRub(t, p)} ₽</div>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/register"
                    className={`mt-6 block rounded-xl px-6 py-3 text-center font-semibold shadow-card transition-transform hover:-translate-y-0.5 ${
                      highlighted
                        ? "bg-gradient-to-r from-brand to-indigo-500 text-white"
                        : "border border-brand/40 text-brand hover:bg-brand/5"
                    }`}
                  >
                    Начать бесплатно
                  </Link>
                  <span className="sr-only">Тариф {idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          14 дней бесплатного пробного периода на каждый новый проект · без привязки карты
        </p>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        <p>© {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.</p>
        <p className="mt-2">ИП Федоткин Максим Сергеевич, ИНН 920358422008</p>
        <p className="mt-2">
          Поддержка:{" "}
          <a
            href="mailto:support@logsy.ru"
            className="text-brand hover:underline"
          >
            support@logsy.ru
          </a>
        </p>
      </footer>
    </main>
  );
}
