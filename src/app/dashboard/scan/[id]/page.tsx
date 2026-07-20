import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { ScanReportView, type ScanReport } from "@/components/ScanReportView";

export const dynamic = "force-dynamic";

export default async function ScanDetailPage({ params }: { params: { id: string } }) {
  // Страница доступна только администраторам.
  if (!(await isAdmin())) notFound();

  const scan = await prisma.siteScan.findUnique({ where: { id: params.id } });
  if (!scan) notFound();

  let report: ScanReport | null = null;
  try {
    report = JSON.parse(scan.report) as ScanReport;
  } catch {
    report = null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/dashboard/scan"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-card transition-colors hover:border-brand hover:text-brand dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          Назад к обходам
        </Link>
        <h1 className="mt-4 text-2xl font-bold">{scan.domain}</h1>
        <p className="text-sm text-slate-500">
          Обход от {new Date(scan.createdAt).toLocaleString("ru-RU")}
        </p>
      </div>

      {report ? (
        <ScanReportView report={report} scanId={scan.id} />
      ) : (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Не удалось прочитать сохранённый отчёт.
        </div>
      )}
    </div>
  );
}
