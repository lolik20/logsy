import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  FREE_TIER,
  FREE_SESSIONS_PER_DAY,
  FREE_RETENTION_HOURS,
  RUB_PER_SESSION_MONTH,
  RUB_PER_RETENTION_HOUR_MONTH,
  retentionHoursLabel,
} from "@/lib/pricing";
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
    title: "Алерты на почту и в Telegram",
    text: "Упал сайт или API — сразу письмо на почту и сообщение в Telegram.",
    icon: "✉️",
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
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
          Узнавайте о падении сайта{" "}
          <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
            раньше клиентов
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
          Проверяем сайты и API каждую минуту, ловим ошибки фронтенда в проде и
          сразу шлём уведомление о сбое на почту и в Telegram. Настройка за пару
          минут.
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

      </section>

      {/* Логирование фронтенда — новое направление */}
      <section id="logging" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-brand p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/80 p-8 backdrop-blur-xl sm:p-12 dark:bg-slate-900/80">
            <div className="text-center">
              <h2 className="mx-auto max-w-3xl text-3xl font-bold sm:text-4xl">
                Следите за ошибками прода{" "}
                <span className="bg-gradient-to-r from-brand to-indigo-500 bg-clip-text text-transparent">
                  глазами пользователя
                </span>
              </h2>
            </div>

            {/* Запись экрана сессий — блок со «скриншотом» плеера воспроизведения */}
            <div className="mt-12 grid items-center gap-8 md:grid-cols-2">
              {/* Текст (на десктопе — слева) */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                  🎬 Запись сессий
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Смотрите сессию как видео
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Включите запись экрана — и каждая сессия воспроизводится как
                  видео: видно, что пользователь видел и куда нажимал перед сбоем.
                  На дорожке отмечены ошибки и медленные запросы — перематывайте
                  прямо к нужному моменту.
                </p>
                <ul className="mt-5 space-y-2.5 text-sm">
                  {[
                    "Точное воспроизведение экрана сессии без нагрузки на сайт",
                    "Метки ошибок и тормозов прямо на таймлайне — клик, и вы на месте сбоя",
                    "Поля ввода и пароли маскируются на клиенте — приватность сохранена",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand">✓</span>
                      <span className="text-slate-600 dark:text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* «Скриншот»: окно плеера воспроизведения сессии */}
              <div className="mx-auto w-full max-w-md">
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
                  {/* Верхняя панель браузера */}
                  <div className="flex items-center gap-1.5 border-b border-slate-200/80 bg-slate-50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-800/60">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    <span className="ml-2 flex-1 truncate rounded-md bg-white px-2 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900">
                      example.ru/checkout
                    </span>
                    <span className="flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold text-red-600 dark:bg-red-950/40 dark:text-red-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                      REC
                    </span>
                  </div>
                  {/* Воспроизводимая страница с кнопкой play */}
                  <div className="relative h-56 bg-white dark:bg-slate-900">
                    <div className="space-y-2.5 p-4">
                      <div className="h-3.5 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-2.5 w-3/4 rounded bg-slate-100 dark:bg-slate-800" />
                      <div className="h-20 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                      <div className="flex gap-2">
                        <div className="h-8 w-24 rounded-lg bg-brand/20" />
                        <div className="h-8 w-16 rounded-lg bg-slate-100 dark:bg-slate-800" />
                      </div>
                    </div>
                    {/* Курсор пользователя */}
                    <svg
                      viewBox="0 0 24 24"
                      className="absolute left-[38%] top-[58%] h-5 w-5 -rotate-12 fill-slate-900 drop-shadow dark:fill-white"
                    >
                      <path d="M5 3l14 8-6 1.5L9 20 5 3z" />
                    </svg>
                    {/* Кнопка воспроизведения по центру */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/90 text-white shadow-lg backdrop-blur">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-5 w-5">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  {/* Панель управления плеером с таймлайном */}
                  <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-3 w-3">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                      {/* Дорожка воспроизведения с метками событий */}
                      <div className="relative h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: "40%" }} />
                        <span
                          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"
                          style={{ left: "40%" }}
                        />
                        <span
                          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-amber-500"
                          style={{ left: "55%" }}
                          title="Медленный запрос"
                        />
                        <span
                          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-red-500"
                          style={{ left: "72%" }}
                          title="Ошибка"
                        />
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">1:24 / 3:47</span>
                    </div>
                  </div>
                </div>
              </div>
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

            {/* Доска задач (канбан) — блок со «скриншотом» доски */}
            <div className="mt-12">
              <div className="mx-auto max-w-3xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                  🗂️ Доска задач
                </span>
                <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
                  Ошибки сами превращаются в задачи
                </h3>
                <p className="mt-3 text-slate-600 dark:text-slate-400">
                  Каждое сообщение об ошибке становится карточкой на канбан-доске.
                  Перетаскивайте между колонками «Создано → В работе → Выполнено» —
                  в карточке ссылка на сессию, почта и приоритет.
                </p>
              </div>

              {/* «Скриншот»: канбан-доска */}
              <div className="mx-auto mt-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card dark:border-slate-700/70 dark:bg-slate-900">
                {/* Верхняя панель доски */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-4 py-3 dark:border-slate-700/70">
                  <span className="text-xs font-semibold text-slate-500">
                    Доска задач · example.ru
                  </span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-800">
                    7 задач
                  </span>
                </div>
                {/* Колонки */}
                <div className="grid gap-3 overflow-x-auto p-4 sm:grid-cols-3">
                  {[
                    {
                      title: "Создано",
                      dot: "bg-slate-400",
                      cards: [
                        { t: "HTTP 500 /api/pay", pr: "Высокий", prCls: "bg-red-100 text-red-700", meta: "Сессия #4821" },
                        { t: "Медленный /catalog (2,1 с)", pr: "Средний", prCls: "bg-amber-100 text-amber-700", meta: "Сессия #4818" },
                      ],
                    },
                    {
                      title: "В работе",
                      dot: "bg-blue-500",
                      cards: [
                        { t: "TypeError в checkout.js", pr: "Высокий", prCls: "bg-red-100 text-red-700", meta: "Сессия #4805", hi: true },
                        { t: "Не грузится /img/hero.png", pr: "Низкий", prCls: "bg-slate-200 text-slate-600", meta: "Сессия #4790" },
                      ],
                    },
                    {
                      title: "Выполнено",
                      dot: "bg-emerald-500",
                      cards: [
                        { t: "Отвалилась авторизация", pr: "Высокий", prCls: "bg-red-100 text-red-700", meta: "Сессия #4771", done: true },
                        { t: "Ошибка формы оплаты", pr: "Средний", prCls: "bg-amber-100 text-amber-700", meta: "Сессия #4762", done: true },
                        { t: "404 на /promo", pr: "Низкий", prCls: "bg-slate-200 text-slate-600", meta: "Сессия #4750", done: true },
                      ],
                    },
                  ].map((col) => (
                    <div
                      key={col.title}
                      className="min-w-[200px] rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                          {col.title}
                        </span>
                        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400 dark:bg-slate-900">
                          {col.cards.length}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {col.cards.map((c, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border bg-white p-2.5 text-left shadow-sm dark:bg-slate-900 ${
                              "hi" in c && c.hi
                                ? "border-brand/50 ring-1 ring-brand/20"
                                : "border-slate-200/80 dark:border-slate-700/70"
                            }`}
                          >
                            <p
                              className={`truncate text-xs font-medium text-slate-700 dark:text-slate-200 ${
                                "done" in c && c.done ? "line-through decoration-slate-300" : ""
                              }`}
                            >
                              {c.t}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${c.prCls}`}>
                                {c.pr}
                              </span>
                              <span className="truncate font-mono text-[9px] text-slate-400">
                                {c.meta}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { t: "Запись сессий", s: "Записываем экран сессии и воспроизводим как видео — с метками ошибок и медленных запросов на таймлайне. Поля ввода маскируются.", icon: "🎬" },
                { t: "Фронт-ошибки", s: "Ловим необработанные исключения и отклонённые промисы со стеком.", icon: "🐞" },
                { t: "Ошибки бэкенда на фронте", s: "Видим упавшие 4xx/5xx запросы: маршрут, метод, payload, код ответа.", icon: "🔌" },
                { t: "Медленные запросы", s: "Отмечаем всё, что грузится дольше заданного порога — узкие места видны сразу.", icon: "🐢" },
                { t: "Карта загрузки страниц", s: "Бот обходит домен и строит дерево разделов: среднее время загрузки, медленные запросы и файлы по каждой странице.", icon: "🗺️" },
                { t: "Сессии пользователей", s: "Все события группируются в сессию — виден весь путь до ошибки.", icon: "🧭" },
                { t: "Обратная связь от пользователей", s: "Кнопка «Сообщить об ошибке» на сайте: посетитель опишет проблему — сообщение попадёт в его сессию и придёт вам на почту и в Telegram.", icon: "💬" },
                { t: "Доска задач (канбан)", s: "Сообщения об ошибках сами становятся задачами: колонки «Создано → В работе → Выполнено», перетаскивание, почта и ссылка на сессию в карточке.", icon: "🗂️" },
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
                  РФ и шлём уведомление при сбое на почту и в Telegram — вы
                  чините раньше, чем заметят клиенты.
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
                  { t: "Почта и Telegram", s: "уведомление мгновенно при сбое" },
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

      {/* Безопасность и соответствие 152-ФЗ */}
      <section id="security" className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-brand p-[1.5px] shadow-card">
          <div className="rounded-[calc(1.5rem-1.5px)] bg-white/80 p-8 backdrop-blur-xl sm:p-12 dark:bg-slate-900/80">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                  🛡️ Безопасность и 152-ФЗ
                </span>
                <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
                  Данные под защитой и хранятся в России
                </h2>
                <p className="mt-4 text-slate-600 dark:text-slate-300">
                  Все данные размещены на серверах в РФ в соответствии с
                  Федеральным законом № 152-ФЗ «О персональных данных».
                  Конфиденциальные данные — реквизиты банковских карт и пароли —
                  не сохраняются: они маскируются на стороне пользователя ещё до
                  отправки.
                </p>
                <Link
                  href="/register"
                  className="mt-6 inline-block rounded-xl bg-gradient-to-r from-emerald-500 to-brand px-6 py-3 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
                >
                  Начать бесплатно
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  {
                    icon: "🇷🇺",
                    t: "Серверы в России",
                    s: "Хранение и обработка данных на площадках в РФ.",
                  },
                  {
                    icon: "📜",
                    t: "Соответствие 152-ФЗ",
                    s: "Работаем по закону «О персональных данных».",
                  },
                  {
                    icon: "💳",
                    t: "Карты не сохраняем",
                    s: "Реквизиты карт не попадают в логи и записи.",
                  },
                  {
                    icon: "🔑",
                    t: "Пароли маскируются",
                    s: "Значения полей ввода скрываются на клиенте.",
                  },
                ].map((c) => (
                  <div
                    key={c.t}
                    className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="text-2xl">{c.icon}</div>
                    <h3 className="mt-3 text-base font-semibold">{c.t}</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                      {c.s}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Тарифы — кастомные, настраиваются ползунками */}
      <section id="pricing" className="relative z-10 mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-center text-3xl font-bold">Тарифы — платите за нужное</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-slate-500">
          Никаких фиксированных пакетов. Настройте суточную квоту сессий и срок
          хранения логов ползунками — цена считается автоматически.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
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
              <div className="mt-2 text-sm font-medium text-slate-500">
                {FREE_SESSIONS_PER_DAY} сессий в сутки · хранение{" "}
                {retentionHoursLabel(FREE_RETENTION_HOURS)}
              </div>

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

          {/* Кастомный тариф */}
          <div className="rounded-3xl bg-gradient-to-br from-brand to-indigo-500 p-[1.5px] shadow-card transition-transform hover:-translate-y-1">
            <div className="flex h-full flex-col rounded-[calc(1.5rem-1.5px)] bg-white/85 p-7 backdrop-blur-xl dark:bg-slate-900/85">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold uppercase tracking-wide text-brand">
                  Кастомный
                </span>
                <span className="rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                  Ползунки
                </span>
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">от 0 ₽</span>
                <span className="text-slate-500">/ проект в месяц</span>
              </div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                Сколько нужно сессий и хранения — столько и платите
              </div>

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-brand">✓</span>
                  <span>
                    Первые {FREE_SESSIONS_PER_DAY} сессий в сутки и{" "}
                    {retentionHoursLabel(FREE_RETENTION_HOURS)} хранения — бесплатно
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand">✓</span>
                  <span>
                    {RUB_PER_SESSION_MONTH} ₽/мес за каждую суточную сессию сверх{" "}
                    {FREE_SESSIONS_PER_DAY}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand">✓</span>
                  <span>
                    {RUB_PER_RETENTION_HOUR_MONTH} ₽/мес за каждый час хранения сверх{" "}
                    {FREE_RETENTION_HOURS}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand">✓</span>
                  <span>Скидки за период: −10% на 3 месяца, −20% на год</span>
                </li>
              </ul>

              <Link
                href="/register"
                className="mt-6 block rounded-xl bg-gradient-to-r from-brand to-indigo-500 px-6 py-3 text-center font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
              >
                Настроить тариф
              </Link>
            </div>
          </div>
        </div>
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
