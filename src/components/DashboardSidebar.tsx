"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import type { SubscriptionStatus } from "@/lib/subscription";

type IconProps = { className?: string };

function GridIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function CardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function LogsIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" />
      <path d="M8 8h8" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

function LogoutIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

function MenuIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function CloseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

const links = [
  { href: "/dashboard", label: "Мониторинг", Icon: GridIcon },
  { href: "/dashboard/contacts", label: "Контакты", Icon: MailIcon },
  { href: "/dashboard/billing", label: "Тарифы", Icon: CardIcon },
];

// Пункты меню, доступные только администраторам.
const adminLinks = [
  { href: "/dashboard/users", label: "Пользователи", Icon: UsersIcon },
];

const soonLinks = [
  { label: "Логирование", Icon: LogsIcon },
];

const toneStyles: Record<
  SubscriptionStatus["tone"],
  { dot: string; text: string }
> = {
  trial: {
    dot: "bg-green-500",
    text: "text-green-700 dark:text-green-300",
  },
  active: {
    dot: "bg-brand",
    text: "text-brand",
  },
  inactive: {
    dot: "bg-red-500",
    text: "text-red-600 dark:text-red-400",
  },
};

function BalanceStatus({ subscription }: { subscription: SubscriptionStatus }) {
  const tone = toneStyles[subscription.tone];
  return (
    <Link
      href="/dashboard/billing"
      title={
        subscription.showPeriodEnd && subscription.periodEnd
          ? `${subscription.label} — до ${subscription.periodEnd}`
          : subscription.label
      }
      className="mx-3 mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${tone.text}`}>
          {subscription.label}
        </span>
        {subscription.showPeriodEnd && subscription.periodEnd && (
          <span className="block text-xs text-slate-400">
            до {subscription.periodEnd}
          </span>
        )}
      </span>
    </Link>
  );
}

// Внутреннее наполнение панели: логотип, навигация, статус подписки, футер.
// Используется и для десктопного сайдбара, и для мобильной шторки (бургер).
function SidebarContent({
  email,
  subscription,
  isAdmin = false,
  onNavigate,
}: {
  email: string;
  subscription: SubscriptionStatus;
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const navLinks = isAdmin ? [...links, ...adminLinks] : links;

  return (
    <>
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white shadow-card">
          L
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">
          Logsy
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navLinks.map(({ href, label, Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand dark:bg-brand/15"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}

        {soonLinks.map(({ label, Icon }) => (
          <div
            key={label}
            title={`${label} — скоро`}
            aria-disabled="true"
            className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 dark:text-slate-500"
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span>{label}</span>
            <span className="ml-auto rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand dark:bg-brand/15">
              Скоро
            </span>
          </div>
        ))}
      </nav>

      <BalanceStatus subscription={subscription} />

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="truncate px-3 pb-2 pt-1 text-xs text-slate-400">
          {email}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/40"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          <span>Выйти</span>
        </button>
      </div>
    </>
  );
}

export function DashboardSidebar({
  email,
  subscription,
  isAdmin = false,
}: {
  email: string;
  subscription: SubscriptionStatus;
  isAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Закрываем шторку при переходе на другую страницу.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Блокируем прокрутку фона, пока открыта мобильная шторка.
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
      {/* Десктопный сайдбар */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/50 bg-white/70 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-slate-900/60">
        <SidebarContent
          email={email}
          subscription={subscription}
          isAdmin={isAdmin}
        />
      </aside>

      {/* Мобильная верхняя панель с бургером */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/50 bg-white/80 px-4 backdrop-blur-xl md:hidden dark:border-white/10 dark:bg-slate-900/70">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <MenuIcon className="h-6 w-6" />
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-xs font-bold text-white shadow-card">
            L
          </span>
          <span className="text-base font-bold text-slate-900 dark:text-white">
            Logsy
          </span>
        </span>
      </header>

      {/* Затемнение под шторкой */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
          aria-hidden="true"
        />
      )}

      {/* Мобильная шторка (бургер-меню) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 md:hidden dark:border-slate-800 dark:bg-slate-900 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Закрыть меню"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
        <SidebarContent
          email={email}
          subscription={subscription}
          isAdmin={isAdmin}
          onNavigate={() => setOpen(false)}
        />
      </aside>
    </>
  );
}
