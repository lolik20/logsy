import Link from "next/link";

// Общий подвал лендинга: переиспользуется на главной, на страницах под аудитории и на
// посадочных страницах (см. src/components/seo/SeoPage.tsx).
//
// Подвал — единственное место, откуда посадочные страницы получают ссылку со всего
// сайта, поэтому здесь лежит короткая карта разделов: без неё новые страницы остаются
// сиротами и попадают в индекс медленно.

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "Мониторинг",
    links: [
      { href: "/uptime", label: "Доступность сайта" },
      { href: "/uptime/api-monitoring", label: "Мониторинг API" },
      { href: "/ssl-monitoring", label: "SSL-сертификат" },
      { href: "/domain-monitoring", label: "Срок домена" },
    ],
  },
  {
    title: "Логи и сессии",
    links: [
      { href: "/error-logging", label: "Ошибки фронтенда" },
      { href: "/session-replay", label: "Запись сессий" },
      { href: "/alternatives/webvisor", label: "Дополнение к Вебвизору" },
      { href: "/feedback-widget", label: "Обратная связь" },
      { href: "/tasks", label: "Задачи из обращений" },
    ],
  },
  {
    title: "Проверки",
    links: [
      { href: "/site-check", label: "Проверить сайт" },
      { href: "/site-audit", label: "Аудит сайта" },
      { href: "/speed-test", label: "Скорость сайта" },
      { href: "/tools/redirects", label: "Редиректы" },
      { href: "/tools/whois", label: "Whois домена" },
      { href: "/tools/dns", label: "DNS-записи" },
    ],
  },
  {
    title: "152-ФЗ и документы",
    links: [
      { href: "/legal/privacy-generator", label: "Генератор политики" },
      { href: "/tools/152fz-check", label: "Проверка 152-ФЗ" },
      { href: "/cookie-banner", label: "Cookie и согласия" },
      { href: "/blog/rkn-notification", label: "Уведомление в РКН" },
      { href: "/monitoring-from-russia", label: "Данные в России" },
    ],
  },
  {
    title: "Разработчикам",
    links: [
      { href: "/docs/api", label: "Документация API" },
      { href: "/docs/for-agents", label: "Для ИИ-агентов" },
      { href: "/integrations/claude-code", label: "Claude Code" },
      { href: "/blog/fix-code-errors-ai", label: "Ошибки в коде и ИИ" },
    ],
  },
  {
    title: "Кому подходит",
    links: [
      { href: "/for-owners", label: "Владельцам сайтов" },
      { href: "/for-marketers", label: "Маркетологам" },
      { href: "/for-developers", label: "Программистам" },
      { href: "/for-ecommerce", label: "Интернет-магазинам" },
      { href: "/pricing", label: "Тарифы" },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-10 text-sm text-slate-500 dark:border-slate-800">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
          {COLUMNS.map((col) => (
            <nav key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {col.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-brand">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center dark:border-slate-800">
          <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/free" className="hover:text-brand">
              Бесплатный тариф
            </Link>
            <Link href="/offer" className="hover:text-brand">
              Оферта
            </Link>
            <Link href="/privacy" className="hover:text-brand">
              Политика конфиденциальности
            </Link>
          </nav>
          <p>© {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.</p>
          <p className="mt-2">ИП Федоткин Максим Сергеевич, ИНН 920358422008</p>
          <p className="mt-2">
            Поддержка:{" "}
            <a href="mailto:support@logsy.ru" className="text-brand hover:underline">
              support@logsy.ru
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
