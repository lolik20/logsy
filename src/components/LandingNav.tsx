"use client";

import Link from "next/link";
import { useState } from "react";

const navLinks = [
  { href: "/#features", label: "Мониторинг" },
  { href: "/#logging", label: "Сессии" },
  { href: "/speed-test", label: "Скорость сайта" },
  { href: "/#pricing", label: "Тарифы" },
];

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function LandingNav({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 mx-auto flex max-w-6xl items-center justify-between rounded-b-2xl border-b border-white/40 bg-white/60 px-6 py-4 backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-base font-bold text-white shadow-card">
          L
        </span>
        <span className="text-2xl font-bold text-slate-900 dark:text-white">Logsy</span>
      </Link>

      {/* Ссылки на разделы — десктоп */}
      <nav className="hidden items-center gap-6 md:flex">
        {navLinks.map((l) => (
          <a
            key={l.href}
            href={l.href}
            className="text-sm font-medium text-slate-600 transition-colors hover:text-brand dark:text-slate-300"
          >
            {l.label}
          </a>
        ))}
      </nav>

      {/* CTA — десктоп */}
      <div className="hidden items-center gap-3 md:flex">
        {authed ? (
          <Link
            href="/dashboard"
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Панель управления
          </Link>
        ) : (
          <>
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:text-brand dark:text-slate-200"
            >
              Войти
            </Link>
            <Link
              href="/register"
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card hover:bg-brand-dark"
            >
              Начать
            </Link>
          </>
        )}
      </div>

      {/* Бургер — мобильные */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Закрыть меню" : "Открыть меню"}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
      </button>

      {/* Выпадающее мобильное меню */}
      {open && (
        <div className="absolute inset-x-3 top-full mt-2 rounded-2xl border border-white/50 bg-white/90 p-4 shadow-card backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-900/90">
          <nav className="flex flex-col gap-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
            {authed ? (
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-dark"
              >
                Панель управления
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-semibold text-white shadow-card hover:bg-brand-dark"
                >
                  Начать
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
