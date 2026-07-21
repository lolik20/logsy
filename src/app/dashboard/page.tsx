import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectManager } from "@/components/ProjectManager";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusAutoRefresh } from "@/components/StatusAutoRefresh";
import { statusSignature } from "@/lib/status";
import { AdminMonitoring } from "@/components/AdminMonitoring";
import { Faq } from "@/components/Faq";
import { Onboarding, type OnboardingStep } from "@/components/Onboarding";

export const dynamic = "force-dynamic";

const monitoringFaq = [
  {
    q: "Как добавить сайт для мониторинга?",
    a: 'Нажмите «Добавить сайт», укажите название и домен (например example.ru). Внутри сайта можно завести несколько проверок.',
  },
  {
    q: "Как добавить монитор (проверку)?",
    a: "Откройте сайт и нажмите «Добавить монитор». Укажите путь для проверки, HTTP-метод и периодичность — мы будем регулярно опрашивать адрес и сообщать, если он станет недоступен.",
  },
  {
    q: "Как я узнаю, что сайт упал?",
    a: 'Уведомления приходят на каналы из вкладки «Контакты» (email или Telegram). Добавьте хотя бы один канал, иначе оповещения приходить не будут.',
  },
];

export default async function DashboardPage() {
  const userId = (await getUserId())!;

  // Администратор видит на вкладке «Мониторинг» проекты всех пользователей.
  if (await isAdmin()) {
    return <AdminMonitoring />;
  }

  const [projects, contactsCount] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        monitors: {
          select: { id: true, lastStatus: true, lastCheckedAt: true },
        },
      },
    }),
    prisma.contact.count({ where: { userId, verified: true } }),
  ]);

  const signature = statusSignature(projects.flatMap((p) => p.monitors));

  // Шаги онбординга для новых пользователей: завести проект, дождаться первой
  // проверки монитора (создаётся автоматически вместе с проектом) и подключить
  // канал оповещений. Панель скрывается пользователем вручную.
  const firstProjectId = projects[projects.length - 1]?.id;
  const hasMonitor = projects.some((p) => p.monitors.length > 0);
  const onboardingSteps: OnboardingStep[] = [
    {
      key: "project",
      title: "Добавьте первый сайт",
      description:
        "Укажите название и домен сайта — мы сразу заведём проверку главной страницы.",
      done: projects.length > 0,
    },
    {
      key: "monitor",
      title: "Проверка главной страницы работает",
      description:
        "Вместе с сайтом создаётся монитор главной страницы (GET /). Мы регулярно опрашиваем сайт и следим за доступностью.",
      done: hasMonitor,
      href: firstProjectId ? `/dashboard/projects/${firstProjectId}` : undefined,
      actionLabel: "Открыть сайт",
    },
    {
      key: "alerts",
      title: "Подключите канал оповещений",
      description:
        "Добавьте email или Telegram во вкладке «Контакты», чтобы получать уведомления о падении сайта.",
      done: contactsCount > 0,
      href: firstProjectId
        ? `/dashboard/projects/${firstProjectId}/contacts`
        : undefined,
      actionLabel: "Настроить",
    },
  ];

  return (
    <div>
      <StatusAutoRefresh initialSignature={signature} />
      <Onboarding steps={onboardingSteps} />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Сайты</h1>
          <p className="text-sm text-slate-500">
            Тарификация — за сайт. Новый сайт работает на бесплатном тарифе.
          </p>
        </div>
      </div>

      <ProjectManager canAdd />

      <div className="mt-6 grid gap-4">
        {projects.length === 0 && (
          <div className="rounded-2xl border border-brand/30 bg-brand/5 p-6 dark:border-brand/40 dark:bg-brand/10">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-white">
                DEMO
              </span>
              <h3 className="text-lg font-bold">Посмотрите панель на демо-сайте</h3>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Пока нет своих сайтов — откройте демонстрационный сайт «Demo Shop».
              Внутри весь функционал панели как на подключённом сайте: мониторинг,
              ошибки, медленные запросы и тестовая сессия с записью экрана. Рядом с
              каждым блоком — пояснение к функции.
            </p>
            <Link
              href="/dashboard/demo"
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Открыть демо-сайт →
            </Link>
          </div>
        )}
        {projects.map((p) => {
          const down = p.monitors.filter((m) => m.lastStatus === "DOWN").length;
          const status =
            p.monitors.length === 0
              ? "PENDING"
              : down > 0
                ? "DOWN"
                : "UP";
          return (
            <Link
              key={p.id}
              href={`/dashboard/projects/${p.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 hover:border-brand dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <StatusBadge status={status} />
                </div>
                <div className="mt-1 text-sm text-slate-500">{p.domain}</div>
              </div>
              <div className="text-right text-sm text-slate-500">
                {p.monitors.length} монитор(ов)
                {down > 0 && (
                  <div className="text-red-600">{down} недоступно</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <Faq items={monitoringFaq} />
      </div>
    </div>
  );
}
