"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";

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

function BellIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
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

function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

function BoardIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="6" height="16" rx="1.5" />
      <rect x="10" y="4" width="6" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="7" rx="1.5" />
    </svg>
  );
}

function SitemapIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4" />
      <path d="M6 16v-2h12v2" />
    </svg>
  );
}

function PlugIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6" />
      <path d="M15 2v6" />
      <path d="M6 8h12v3a6 6 0 0 1-12 0z" />
      <path d="M12 17v5" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
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

function TelegramIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.94 4.6 18.9 19.05c-.23 1.01-.83 1.26-1.68.79l-4.65-3.43-2.24 2.16c-.25.25-.46.46-.94.46l.33-4.74 8.63-7.8c.38-.33-.08-.52-.58-.19l-10.67 6.72-4.6-1.44c-1-.31-1.02-1 .21-1.48l17.99-6.93c.83-.31 1.56.2 1.29 1.43Z" />
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

export type SidebarProject = { id: string; name: string };

// Сервисы внутри проекта (второй уровень меню). href — суффикс к /dashboard/projects/[id].
const SERVICES = [
  { key: "monitoring", label: "Мониторинг", suffix: "", Icon: GridIcon },
  { key: "logging", label: "Логирование", suffix: "/logging", Icon: LogsIcon },
  { key: "tasks", label: "Задачи", suffix: "/tasks", Icon: BoardIcon },
  { key: "pages", label: "Страницы", suffix: "/pages", Icon: SitemapIcon },
  { key: "connection", label: "Подключение", suffix: "/connection", Icon: PlugIcon },
  { key: "alerts", label: "Алерты", suffix: "/alerts", Icon: BellIcon },
  { key: "tariff", label: "Тариф", suffix: "/tariff", Icon: CardIcon },
];

/** Достаёт id активного проекта из пути /dashboard/projects/<id>/... */
function activeProjectId(pathname: string): string | null {
  const m = pathname.match(/^\/dashboard\/projects\/([^/]+)/);
  return m ? m[1] : null;
}

// Внутреннее наполнение панели: логотип, двухуровневая навигация, футер.
// Используется и для десктопного сайдбара, и для мобильной шторки (бургер).
function SidebarContent({
  email,
  projects,
  isAdmin = false,
  onNavigate,
}: {
  email: string;
  projects: SidebarProject[];
  isAdmin?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const activeId = activeProjectId(pathname);

  // Раскрытые проекты. Активный проект раскрываем автоматически.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (activeId) setExpanded((prev) => ({ ...prev, [activeId]: true }));
  }, [activeId]);

  const toggle = (id: string) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const projectsRootActive = pathname === "/dashboard";

  return (
    <>
      <div className="flex h-16 items-center gap-2 px-6">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-brand-light text-sm font-bold text-white shadow-card">
          L
        </span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">Logsy</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {/* Первый уровень — список проектов */}
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            projectsRootActive
              ? "bg-brand-50 text-brand dark:bg-brand/15"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <GridIcon className="h-5 w-5 shrink-0" />
          <span>Все проекты</span>
        </Link>

        <div className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Проекты
        </div>

        {projects.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-400">
            Пока нет проектов
          </div>
        )}

        {projects.map((p) => {
          const isOpen = !!expanded[p.id] || activeId === p.id;
          const isActiveProject = activeId === p.id;
          const base = `/dashboard/projects/${p.id}`;
          return (
            <div key={p.id}>
              {/* Второй уровень — проект (раскрывающийся) */}
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActiveProject
                    ? "text-slate-900 dark:text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <FolderIcon className="h-5 w-5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-left">{p.name}</span>
                <ChevronIcon
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                />
              </button>

              {/* Сервисы проекта */}
              {isOpen && (
                <div className="mb-1 ml-4 space-y-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                  {SERVICES.map(({ key, label, suffix, Icon }) => {
                    const href = base + suffix;
                    const active =
                      suffix === ""
                        ? pathname === base
                        : pathname.startsWith(href);
                    return (
                      <Link
                        key={key}
                        href={href}
                        onClick={onNavigate}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                          active
                            ? "bg-brand-50 font-medium text-brand dark:bg-brand/15"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {isAdmin && (
          <Link
            href="/dashboard/users"
            onClick={onNavigate}
            className={`mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              pathname.startsWith("/dashboard/users")
                ? "bg-brand-50 text-brand dark:bg-brand/15"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <UsersIcon className="h-5 w-5 shrink-0" />
            <span>Пользователи</span>
          </Link>
        )}
      </nav>

      <a
        href="https://telegram.me/tritex_manager"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-3 mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <TelegramIcon className="h-5 w-5 shrink-0 text-brand" />
        <span>Техподдержка</span>
      </a>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <div className="truncate px-3 pb-2 pt-1 text-xs text-slate-400">{email}</div>
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
  projects,
  isAdmin = false,
}: {
  email: string;
  projects: SidebarProject[];
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

  const content = useMemo(
    () => ({ email, projects, isAdmin }),
    [email, projects, isAdmin],
  );

  return (
    <>
      {/* Десктопный сайдбар */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/50 bg-white/70 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-slate-900/60">
        <SidebarContent {...content} />
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
          <span className="text-base font-bold text-slate-900 dark:text-white">Logsy</span>
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
        <SidebarContent {...content} onNavigate={() => setOpen(false)} />
      </aside>
    </>
  );
}
