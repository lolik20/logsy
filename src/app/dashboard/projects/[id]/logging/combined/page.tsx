import { notFound } from "next/navigation";
import { CombinedVisitView, parseCombinedQuery } from "./CombinedVisitView";

export const dynamic = "force-dynamic";

// Полная страница «Все события пользователя» — для прямого захода по URL.
// При переходе по ссылке внутри приложения этот маршрут перехватывается
// и открывается модалкой (см. ../@modal/(.)combined/page.tsx).
export default async function CombinedIpPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ip?: string; date?: string };
}) {
  const { ip, dateStr } = parseCombinedQuery(searchParams);
  if (!ip) notFound();

  return (
    <CombinedVisitView
      projectId={params.id}
      ip={ip}
      dateStr={dateStr}
      variant="page"
    />
  );
}
