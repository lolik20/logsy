import Link from "next/link";

// Общий подвал лендинга: переиспользуется на главной и на страницах-офферах
// под конкретную аудиторию (владельцы сайтов, маркетологи, программисты).
export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
      <nav className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/for-owners" className="hover:text-brand">
          Владельцам сайтов
        </Link>
        <Link href="/for-marketers" className="hover:text-brand">
          Маркетологам
        </Link>
        <Link href="/for-developers" className="hover:text-brand">
          Программистам
        </Link>
        <Link href="/#pricing" className="hover:text-brand">
          Тарифы
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
    </footer>
  );
}
