"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const navLinks = [
  { href: "/demo", label: "Демо" },
  { href: "/#features", label: "Мониторинг" },
  { href: "/#logging", label: "Сессии" },
  { href: "/speed-test", label: "Скорость сайта" },
  { href: "/#compliance", label: "152-ФЗ" },
  { href: "/docs/api", label: "API" },
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

// Шапка фиксированная (не sticky): на посадочных она лежит внутри контейнеров с
// overflow-hidden, где sticky не работает. Высоту в потоке возвращает спейсер ниже.
export function LandingNav({ authed }: { authed: boolean }) {
  const [open, setOpen] = useState(false);

  // Пока открыто мобильное меню — не прокручиваем страницу под ним (важно для iOS).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4">
        {/* Стеклянная «таблетка» — поверх затемняющей подложки меню */}
        <div className="relative z-10 mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-2xl border border-white/40 bg-white/70 px-3 shadow-card backdrop-blur-xl backdrop-saturate-150 sm:px-4 dark:border-white/10 dark:bg-slate-900/60">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-light text-base font-bold text-white shadow-card">
              L
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Logsy</span>
          </Link>

          {/* Ссылки на разделы — десктоп */}
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA — десктоп */}
          <div className="hidden items-center gap-2 md:flex">
            {authed ? (
              <Link
                href="/dashboard"
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Панель управления
              </Link>
            ) : (
              <Link
                href="/register"
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition-colors hover:bg-brand-dark"
              >
                Попробовать бесплатно
              </Link>
            )}
          </div>

          {/* Бургер — мобильные, тач-таргет 44×44 */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={open}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition-colors active:bg-slate-900/10 md:hidden dark:text-slate-200 dark:active:bg-white/10"
          >
            {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>

        {/* Мобильное меню: затемняющая подложка + стеклянный лист в стиле iOS */}
        {open && (
          <>
            <div
              aria-hidden
              onClick={() => setOpen(false)}
              className="fixed inset-0 animate-fade-in bg-slate-900/25 backdrop-blur-sm md:hidden"
            />
            <div className="absolute inset-x-3 top-full z-10 mt-2 origin-top animate-menu-in rounded-3xl border border-white/40 bg-white/85 p-2 shadow-2xl backdrop-blur-xl backdrop-saturate-150 md:hidden dark:border-white/10 dark:bg-slate-900/85">
              <nav className="flex flex-col">
                {navLinks.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3 text-[15px] font-medium text-slate-700 transition-colors active:bg-slate-900/5 dark:text-slate-200 dark:active:bg-white/10"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-2 flex flex-col gap-2 border-t border-slate-900/10 p-2 pt-3 dark:border-white/10">
                {authed ? (
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-brand px-4 py-3 text-center text-[15px] font-semibold text-white active:bg-brand-dark"
                  >
                    Панель управления
                  </Link>
                ) : (
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="rounded-full bg-brand px-4 py-3 text-center text-[15px] font-semibold text-white shadow-card active:bg-brand-dark"
                  >
                    Попробовать бесплатно
                  </Link>
                )}
              </div>
            </div>
          </>
        )}
      </header>

      {/* Спейсер: возвращает высоту фиксированной шапки в поток страницы */}
      <div aria-hidden className="h-[calc(3.5rem_+_max(0.75rem,env(safe-area-inset-top)))]" />
    </>
  );
}
