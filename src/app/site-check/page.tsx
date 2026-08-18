// Публичная проверка сайта: форма ввода адреса и отчёт под ней.
//
// Страница индексируется под проверочные запросы («проверить сайт на ошибки»,
// «проверка сайта на соответствие 152-ФЗ»), поэтому кроме формы здесь есть текст о том,
// что именно проверяется, FAQ с микроразметкой и один призыв к действию.

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { SiteCheckForm } from "@/components/SiteCheckForm";
import { appUrl } from "@/lib/api-docs";
import { issueCheckToken } from "@/lib/site-check-token";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Проверить сайт онлайн: ошибки, скорость и 152-ФЗ",
  description:
    "Бесплатная проверка сайта настоящим браузером: ошибки запросов, медленная загрузка, проблемы форм и соответствие 152-ФЗ. Введите адрес — отчёт за 40 секунд.",
  alternates: { canonical: "/site-check" },
  openGraph: {
    title: "Проверить сайт онлайн: ошибки, скорость и 152-ФЗ",
    description:
      "Обход сайта настоящим браузером: ошибки, медленные запросы, формы и проверка по 152-ФЗ. Бесплатно, без регистрации.",
    type: "website",
    locale: "ru_RU",
    siteName: "Logsy",
  },
};

const FAQ = [
  {
    q: "Что именно проверяется?",
    a: "Бот открывает сайт настоящим браузером, исполняет скрипты и обходит до шести страниц по внутренним ссылкам. Собирает коды ответов, упавшие и медленные запросы, ошибки JavaScript, разметку форм и признаки соответствия 152-ФЗ: политику, галочки согласия, счётчики и реквизиты оператора.",
  },
  {
    q: "Проверка что-то меняет на сайте?",
    a: "Нет. Формы не заполняются и не отправляются, данные не изменяются — бот только читает страницы, как обычный посетитель.",
  },
  {
    q: "Почему проверка идёт так долго?",
    a: "Это не пинг, а настоящий обход: браузер грузит страницы целиком со скриптами и стилями. На это уходит до 40 секунд.",
  },
  {
    q: "Проверка 152-ФЗ заменяет юриста?",
    a: "Нет. Это техническая проверка того, что видно снаружи. Она не знает, подано ли уведомление в Роскомнадзор, есть ли договоры с подрядчиками и где физически лежит база данных.",
  },
  {
    q: "Можно проверять чужой сайт?",
    a: "Да, обход читает только публично доступные страницы. Чтобы не нагружать чужой сайт, повторная проверка того же домена доступна раз в 15 минут, а с одного адреса — не больше пяти проверок в час.",
  },
];

export default async function SiteCheckPage() {
  const session = await auth();
  const base = appUrl();
  // Токен живёт 30 минут и подтверждает, что запрос пришёл со страницы, а не из скрипта.
  const token = issueCheckToken();

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Logsy", item: base },
        { "@type": "ListItem", position: 2, name: "Проверка сайта", item: `${base}/site-check` },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ];

  return (
    <main className="min-h-screen">
      <LandingNav authed={!!session} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        <nav className="text-sm text-slate-500">
          <Link href="/" className="hover:text-brand">
            Logsy
          </Link>{" "}
          / Проверка сайта
        </nav>

        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
          Проверить сайт онлайн: ошибки, скорость и соответствие 152-ФЗ
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          Бот откроет сайт настоящим браузером, пройдёт по внутренним ссылкам и покажет то,
          что видит посетитель: упавшие запросы, медленные места, проблемы форм и юридические
          пробелы. Без регистрации.
        </p>

        <div className="mt-8">
          <SiteCheckForm token={token} />
        </div>

        {/* Что входит в отчёт */}
        <section className="mt-14">
          <h2 className="text-xl font-semibold">Что будет в отчёте</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {[
              ["Ошибки запросов", "Ответы 4xx и 5xx и оборванные соединения — по страницам и по отдельным запросам."],
              ["Медленные места", "Запросы и файлы, которые грузились дольше порога, с реальным временем."],
              ["Ошибки JavaScript", "Исключения, которые ловит браузер при загрузке страниц."],
              ["Формы", "Есть ли кнопка отправки, проверяется ли формат почты, не уходят ли данные по HTTP."],
              ["Соответствие 152-ФЗ", "Политика, галочки согласия, счётчики до согласия, зарубежные сервисы, реквизиты оператора."],
              ["Карта обойдённых страниц", "Коды ответов и время загрузки по каждой странице, до которой дошёл бот."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Ограничения — честно и сразу */}
        <section className="mt-12 rounded-xl border border-slate-200 bg-white/70 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
          <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Границы проверки</h2>
          <ul className="mt-3 space-y-2">
            <li>Обходится до шести страниц — это срез, а не полный аудит сайта.</li>
            <li>Формы не отправляются: проверяется только их разметка.</li>
            <li>Проверка соответствия 152-ФЗ — техническая, юридическое заключение она не заменяет.</li>
            <li>Контакты, найденные на страницах, в отчёт не выводятся.</li>
          </ul>
        </section>

        {/* FAQ */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Частые вопросы</h2>
          <div className="mt-4 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <summary className="cursor-pointer list-none font-medium marker:hidden">
                  <span className="mr-2 inline-block text-brand transition-transform group-open:rotate-90">›</span>
                  {f.q}
                </summary>
                <p className="mt-2 pl-5 text-slate-600 dark:text-slate-300">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-12 rounded-2xl bg-brand-50 p-6 dark:bg-brand/10">
          <h2 className="text-lg font-semibold">Разовая проверка показывает срез</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Сайт ломается не в момент проверки, а между ними. Подключите мониторинг: проверки
            раз в минуту, контроль сертификата и домена, ошибки прода из браузеров посетителей.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-light px-5 py-2.5 font-semibold text-white"
          >
            Подключить бесплатно
          </Link>
          <p className="mt-3 text-sm text-slate-500">Бесплатный тариф навсегда, карта не нужна</p>
        </section>

        <nav className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Читайте дальше</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["/site-audit", "Аудит сайта: что проверяет обход"],
              ["/cookie-banner", "Баннер cookie и согласие по 152-ФЗ"],
              ["/speed-test", "Проверить скорость загрузки сайта"],
              ["/blog/rkn-notification", "Уведомление в Роскомнадзор"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-800 dark:text-slate-300"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <LandingFooter />
    </main>
  );
}
