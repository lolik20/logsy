import Link from "next/link";
import { auth } from "@/lib/auth";
import { TIERS, FREE_TIER } from "@/lib/pricing";
import { LandingNav } from "@/components/LandingNav";

const features = [
  {
    title: "Мониторинг каждую минуту",
    text: "Проверки раз в минуту, час или день — на ваш выбор.",
    icon: "⏱️",
  },
  {
    title: "Любые HTTP-методы",
    text: "GET, POST, PUT, DELETE и нужный код ответа — точная проверка API.",
    icon: "🌐",
  },
  {
    title: "Алерты на почту",
    text: "Упал сайт или API — сразу письмо на ваши контакты.",
    icon: "✉️",
  },
  {
    title: "Проекты и мониторы",
    text: "Мониторы по проектам, вся история проверок под рукой.",
    icon: "📊",
  },
  {
    title: "Контроль SSL-сертификата",
    text: "Предупредим об истечении SSL за неделю, 3 дня, день и час — без внезапного «красного» сайта.",
    icon: "🔒",
  },
  {
    title: "Проверка оплаты и авторизации",
    text: "Оплата, вход, ключевые API — с телом запроса и заголовками.",
    icon: "🔐",
  },
  {
    title: "Российская локация",
    text: "Проверки из РФ, оплата в рублях, данные в РФ, поддержка на русском.",
    icon: "🇷🇺",
  },
];

const problems = [
  {
    title: "Не работает оплата на сайте",
    text: "Платёжный шлюз молча отвалился — заказы не проходят, вы теряете деньги.",
    icon: "💳",
  },
  {
    title: "Отвалилась авторизация",
    text: "Пользователи не могут войти. Вы узнаёте последними — из жалоб.",
    icon: "🔒",
  },
  {
    title: "Клиенты уходят",
    text: "Каждая минута простоя — потерянные клиенты, деньги и репутация.",
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
          Проверяем сайты и API каждую минуту, ловим ошибки фронтенда в проде и
          сразу шлём письмо о сбое. Настройка за пару минут.
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
          Бесплатный тариф навсегда · без привязки карты
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
                  Круглосуточно проверяем оплату, авторизацию и ключевые API из
                  РФ и шлём письмо при сбое — вы чините раньше, чем заметят
                  клиенты.
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
                ловит JS-ошибки, упавшие и медленные запросы, строит карту
                загрузки страниц и собирает всё в сессии. Без SDK и настройки.
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
                { t: "Медленные запросы", s: "Отмечаем всё, что грузится дольше заданного порога — узкие места видны сразу.", icon: "🐢" },
                { t: "Карта загрузки страниц", s: "Бот обходит домен и строит дерево разделов: среднее время загрузки, медленные запросы и файлы по каждой странице.", icon: "🗺️" },
                { t: "Сессии пользователей", s: "Все события группируются в сессию — виден весь путь до ошибки.", icon: "🧭" },
                { t: "Обратная связь от пользователей", s: "Кнопка «Сообщить об ошибке» на сайте: посетитель опишет проблему — сообщение попадёт в его сессию и придёт вам на почту и в Telegram.", icon: "💬" },
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

            {/* Подробный мониторинг сессий — блок со «скриншотом» ленты событий */}
            <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
              {/* Текст (на мобильных — первым, на десктопе — справа) */}
              <div className="md:order-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                  🧭 Сессии пользователей
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Подробный мониторинг каждой сессии
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Весь путь посетителя — переходы, клики, ввод, запросы, ошибки —
                  в единой ленте по времени. Видно, что было до сбоя.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Хронология событий: переходы, клики, ввод, запросы и ошибки",
                    "Группировка по пользователю и IP, страна по гео, метки перехода (UTM)",
                    "«Крошки» перед уходом и аналитика отказов — где теряются клиенты",
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
                  {/* Заголовок карточки сессии */}
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
                  {/* Лента событий сессии */}
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

            {/* Обратная форма ошибок — крупный блок со «скриншотом» виджета */}
            <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                  💬 Обратная связь от пользователей
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Пользователи сами сообщают об ошибках
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Включите форму — и на сайте появится плавающая кнопка «Сообщить
                  об ошибке». Посетитель опишет проблему, вы увидите её в контексте
                  его действий.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Сообщение попадает прямо в сессию пользователя — виден весь путь до жалобы",
                    "Уведомление на почту и в Telegram со ссылкой на сессию",
                    "Тот же тег в <head>, без настройки — работает на ПК и мобильных",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand">✓</span>
                      <span className="text-slate-600 dark:text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* «Скриншот»: окно сайта с открытым виджетом обратной связи */}
              <div className="relative mx-auto w-full max-w-md">
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
                  {/* Верхняя панель браузера */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/60">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900">
                      example.ru
                    </span>
                  </div>
                  {/* Контент страницы + виджет */}
                  <div className="relative h-72 bg-white p-4 dark:bg-slate-900">
                    <div className="space-y-2.5">
                      <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                      <div className="h-2.5 w-2/3 rounded bg-slate-100 dark:bg-slate-800" />
                      <div className="h-24 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>

                    {/* Форма обратной связи (виджет всегда светлый — как в реальном SDK) */}
                    <div className="absolute bottom-16 right-3 w-60 rounded-xl bg-white p-3 text-left shadow-2xl ring-1 ring-black/5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-bold text-slate-900">Сообщить об ошибке</p>
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        >
                          <path d="M18 6 6 18" />
                          <path d="m6 6 12 12" />
                        </svg>
                      </div>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Опишите, что пошло не так — мы это увидим.
                      </p>
                      <div className="mt-2 h-14 rounded-lg border border-brand/40 bg-white p-2 text-[10px] text-slate-400">
                        Не проходит оплата на последнем шаге…
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[9px] text-slate-400">Работает на Logsy</span>
                        <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-semibold text-white">
                          Отправить
                        </span>
                      </div>
                    </div>

                    {/* Плавающая кнопка (FAB) */}
                    <div className="absolute bottom-3 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-5 w-5"
                      >
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Карта загрузки страниц — блок со «скриншотом» дерева разделов */}
            <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
              {/* Текст (на десктопе — справа) */}
              <div className="md:order-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                  🗺️ Страницы
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Карта загрузки страниц сайта
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Бот сам обходит домен и строит дерево разделов. Сразу видно, где сайт
                  тормозит и почему.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Среднее время загрузки по каждой странице",
                    "Клик — и видны медленные запросы и файлы",
                    "Счётчик ошибок и тормозов у каждого раздела",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand">✓</span>
                      <span className="text-slate-600 dark:text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* «Скриншот»: карточка карты загрузки (на десктопе — слева) */}
              <div className="md:order-1">
                <div className="mx-auto w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                    <span className="text-xs font-semibold text-slate-500">
                      Карта загрузки · example.ru
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                      42 страницы
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {[
                      { name: "example.ru", pad: "pl-4", bar: "bg-emerald-500", w: "20%", ms: "0,8 с", msCls: "text-emerald-600" },
                      { name: "/catalog", pad: "pl-6", tag: "каталог", errs: 2, slow: 3, bar: "bg-amber-500", w: "55%", ms: "2,1 с", msCls: "text-amber-600" },
                      { name: "/catalog/item", pad: "pl-10", bar: "bg-red-500", w: "90%", ms: "3,4 с", msCls: "text-red-600", hi: true },
                      { name: "/checkout", pad: "pl-6", errs: 1, bar: "bg-red-500", w: "100%", ms: "4,2 с", msCls: "text-red-600" },
                      { name: "/about", pad: "pl-6", bar: "bg-emerald-500", w: "16%", ms: "0,6 с", msCls: "text-emerald-600" },
                    ].map((r, i) => (
                      <li
                        key={i}
                        className={`flex items-center gap-2 py-2.5 pr-4 ${r.pad} ${
                          r.hi ? "bg-red-50/60 dark:bg-red-950/20" : ""
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700 dark:text-slate-200">
                          {r.name}
                          {r.tag && (
                            <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-400 dark:bg-slate-800">
                              {r.tag}
                            </span>
                          )}
                        </span>
                        {(r.errs || r.slow) && (
                          <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold">
                            {r.errs ? (
                              <span className="flex items-center gap-0.5 text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                {r.errs}
                              </span>
                            ) : null}
                            {r.slow ? (
                              <span className="flex items-center gap-0.5 text-amber-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                                {r.slow}
                              </span>
                            ) : null}
                          </span>
                        )}
                        <span className="hidden h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100 sm:block dark:bg-slate-800">
                          <span className={`block h-full rounded-full ${r.bar}`} style={{ width: r.w }} />
                        </span>
                        <span className={`w-12 shrink-0 text-right text-xs font-semibold ${r.msCls}`}>
                          {r.ms}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* Развёрнутый критический файл под медленной страницей */}
                  <div className="border-t border-slate-100 px-4 py-2.5 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-slate-800/60">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="shrink-0 rounded bg-sky-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          img
                        </span>
                        <span className="truncate font-mono text-[11px] text-slate-600 dark:text-slate-300">
                          /img/hero-banner.png
                        </span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-red-600">1,8 с</span>
                    </div>
                  </div>
                </div>
              </div>
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
          Один тариф на проект: мониторинг, логирование и алерты. Бесплатно без
          карты, скидки 10% за 3 месяца и 20% за год.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {/* Бесплатный тариф */}
          <div className="rounded-3xl bg-white/50 p-[1.5px] shadow-card transition-transform hover:-translate-y-1 dark:bg-white/10">
            <div className="flex h-full flex-col rounded-[calc(1.5rem-1.5px)] bg-white/85 p-7 backdrop-blur-xl dark:bg-slate-900/85">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand">
                  {FREE_TIER.name}
                </span>
                <span className="rounded-full bg-green-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Навсегда
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">0 ₽</span>
                <span className="text-slate-500">/ проект в месяц</span>
              </div>
              <div className="mt-2 text-sm font-medium text-slate-500">{FREE_TIER.sessionsLabel}</div>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {FREE_TIER.features.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-brand">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="mt-6 block rounded-xl border border-brand/40 px-6 py-3 text-center font-semibold text-brand shadow-card transition-transform hover:-translate-y-0.5 hover:bg-brand/5"
              >
                Начать бесплатно
              </Link>
            </div>
          </div>

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
          Бесплатный тариф на каждый новый проект — навсегда, без привязки карты
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
