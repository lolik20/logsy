"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
      className="mx-2 mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-100 md:mx-3 dark:hover:bg-slate-800"
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
      <span className="hidden min-w-0 flex-1 md:block">
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

export function DashboardSidebar({
  email,
  subscription,
  isAdmin = false,
}: {
  email: string;
  subscription: SubscriptionStatus;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const navLinks = isAdmin ? [...links, ...adminLinks] : links;

  return (
    <aside className="sticky top-0 flex h-screen w-16 shrink-0 flex-col border-r border-white/50 bg-white/70 backdrop-blur-xl md:w-64 dark:border-white/10 dark:bg-slate-900/60">
      <div className="flex h-16 items-center gap-2 px-4 md:px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white shadow-card">
          L
        </span>
        <span className="hidden text-lg font-bold text-slate-900 md:inline dark:text-white">
          Logsy
        </span>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-4 md:px-3">
        {navLinks.map(({ href, label, Icon }) => {
          const active =
            href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-brand-50 text-brand dark:bg-brand/15"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline">{label}</span>
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
            <span className="hidden md:inline">{label}</span>
            <span className="ml-auto hidden rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand md:inline dark:bg-brand/15">
              Скоро
            </span>
          </div>
        ))}
      </nav>

      <BalanceStatus subscription={subscription} />

      <div className="border-t border-slate-200 p-2 md:p-3 dark:border-slate-800">
        <div className="hidden truncate px-3 pb-2 pt-1 text-xs text-slate-400 md:block">
          {email}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          title="Выйти"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 dark:text-slate-300 dark:hover:bg-red-950/40"
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          <span className="hidden md:inline">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
