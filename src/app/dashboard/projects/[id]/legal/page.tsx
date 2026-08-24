import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ProjectHeader } from "@/components/ProjectHeader";
import { LegalDocsSettings, type LegalFormValues } from "@/components/LegalDocsSettings";
import {
  LEGAL_DOC_TITLES,
  LEGAL_DOC_TYPES,
  currentDocVersions,
  legalDocUrl,
  parseList,
} from "@/lib/legal";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  PD: "Персональные данные",
  MARKETING: "Рассылка",
  COOKIE: "Cookie",
};

/** Версии документов из журнала («политика v3, согласие v2»). */
function docsLabel(raw: string): string {
  const names: Record<string, string> = {
    PRIVACY: "политика",
    OFFER: "оферта",
    CONSENT: "согласие",
  };
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    const parts = Object.entries(parsed)
      .filter(([, version]) => typeof version === "number")
      .map(([type, version]) => `${names[type] ?? type.toLowerCase()} v${version}`);
    return parts.length ? parts.join(", ") : "—";
  } catch {
    return "—";
  }
}

// Вкладка «Документы» — блок 152-ФЗ проекта: реквизиты оператора, автогенерация
// политики / оферты / согласия, галочка в формах сайта и журнал согласий.
export default async function ProjectLegalPage({ params }: { params: { id: string } }) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { legal: true },
  });
  if (!project || (project.userId !== userId && !admin)) notFound();

  const isowner = project.userId === userId;
  const legal = project.legal;

  // Опубликованные версии и постоянные адреса документов.
  const versions = legal ? await currentDocVersions(project.id) : {};
  const docs = legal
    ? LEGAL_DOC_TYPES.map((type) => ({
        type,
        title: LEGAL_DOC_TITLES[type],
        version: versions[type] ?? null,
        url: legalDocUrl(legal.publicSlug, type),
      }))
    : [];

  // Журнал согласий: сколько всего и последние записи.
  const [consentCount, consents] = await Promise.all([
    prisma.consent.count({ where: { projectId: project.id } }),
    prisma.consent.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const initial: LegalFormValues = {
    operatorType: legal?.operatorType ?? "COMPANY",
    operatorName: legal?.operatorName ?? "",
    inn: legal?.inn ?? "",
    ogrn: legal?.ogrn ?? "",
    address: legal?.address ?? "",
    email: legal?.email ?? "",
    phone: legal?.phone ?? "",
    siteUrl: legal?.siteUrl ?? "",
    collectsName: legal?.collectsName ?? true,
    collectsEmail: legal?.collectsEmail ?? true,
    collectsPhone: legal?.collectsPhone ?? true,
    collectsAddress: legal?.collectsAddress ?? false,
    collectsPayment: legal?.collectsPayment ?? false,
    collectsCookies: legal?.collectsCookies ?? true,
    purposes: parseList(legal?.purposes).join("\n"),
    thirdParties: parseList(legal?.thirdParties).join("\n"),
    usesMetrika: legal?.usesMetrika ?? true,
    usesGa: legal?.usesGa ?? false,
    usesMailing: legal?.usesMailing ?? false,
    rknNotifiedAt: legal?.rknNotifiedAt
      ? legal.rknNotifiedAt.toISOString().slice(0, 10)
      : "",
    consentMode: legal?.consentMode ?? "STRICT",
    consentText: legal?.consentText ?? "",
  };

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="legal"
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
          Документы по 152-ФЗ
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Заполните реквизиты один раз — панель соберёт политику обработки персональных
          данных, публичную оферту и текст согласия, разместит их по постоянным адресам и
          будет фиксировать согласия посетителей. Порядок такой: сохранить реквизиты →
          опубликовать документы → включить галочку в формах.
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Шаблоны закрывают типовой сайт с формой заявки и оплатой. Биометрия,
          специальные категории данных, обработка по поручению и трансграничная передача
          требуют правки юристом. Уведомление в Роскомнадзор подаёте вы сами.
        </p>
        {!legal?.rknNotifiedAt && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Не отмечено уведомление в Роскомнадзор (ч. 1 ст. 22 152-ФЗ). Если форма на
            сайте собирает персональные данные, уведомление обязательно — за его
            отсутствие штраф 100 000–300 000 ₽.
          </p>
        )}
      </div>

      {isowner ? (
        <LegalDocsSettings
          projectId={project.id}
          domain={project.domain}
          saved={!!legal}
          initial={initial}
          docs={docs}
          consentEnabled={project.consentEnabled}
        />
      ) : (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Просмотр сайта пользователя в режиме администратора — документы редактирует
          только владелец.
        </div>
      )}

      {/* ---- Журнал согласий ---- */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Журнал согласий</h2>
            <p className="mt-1 text-sm text-slate-500">
              Записи о том, кто и когда поставил галочку: страница, форма, версии
              документов, IP и браузер. Это доказательство согласия по ч. 1 ст. 9 152-ФЗ.
            </p>
          </div>
          {consentCount > 0 && isowner && (
            <a
              href={`/api/projects/${project.id}/legal/consents`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:border-brand hover:text-brand dark:border-slate-700"
            >
              Выгрузить CSV
            </a>
          )}
        </div>

        {consentCount === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Пока пусто. Записи появятся, когда посетители начнут отправлять формы с
            включённой галочкой.
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-slate-400">
              Всего записей: {consentCount}. Ниже — последние 20.
            </p>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="py-2 pr-3 font-medium">Когда</th>
                    <th className="py-2 pr-3 font-medium">Вид</th>
                    <th className="py-2 pr-3 font-medium">Страница</th>
                    <th className="py-2 pr-3 font-medium">Версии</th>
                    <th className="py-2 font-medium">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="whitespace-nowrap py-2 pr-3 text-slate-500">
                        {c.createdAt.toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3">
                        {KIND_LABEL[c.kind] ?? c.kind}
                      </td>
                      <td className="max-w-[280px] truncate py-2 pr-3 text-slate-500" title={c.page}>
                        {c.page}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-xs text-slate-400">
                        {docsLabel(c.docs)}
                      </td>
                      <td className="whitespace-nowrap py-2 font-mono text-xs text-slate-500">
                        {c.ip ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-sm text-slate-500">
        Не уверены, чего сайту не хватает по 152-ФЗ?{" "}
        <Link href="/site-check" className="font-medium text-brand hover:underline">
          Прогоните бесплатную проверку
        </Link>{" "}
        — она покажет, что видно проверяющему снаружи.
      </p>
    </div>
  );
}
