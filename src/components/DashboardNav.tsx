"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const links = [
  { href: "/dashboard", label: "Проекты" },
  { href: "/dashboard/contacts", label: "Контакты" },
  { href: "/dashboard/billing", label: "Тарифы" },
];

export function DashboardNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link href="/dashboard" className="text-xl font-bold text-brand">
            Logsy
          </Link>
          <nav className="flex gap-1">
            {links.map((l) => {
              const active =
                l.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "text-slate-600 hover:text-brand dark:text-slate-300"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:inline">{email}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-red-400 hover:text-red-600 dark:border-slate-700"
          >
            Выйти
          </button>
        </div>
      </div>
    </header>
  );
}
