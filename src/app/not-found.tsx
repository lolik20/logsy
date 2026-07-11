import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div className="text-5xl font-extrabold text-brand">404</div>
        <h1 className="mt-4 text-xl font-semibold">Страница не найдена</h1>
        <p className="mt-2 text-sm text-slate-500">
          Возможно, ссылка устарела или объект был удалён.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          В панель управления
        </Link>
      </div>
    </main>
  );
}
