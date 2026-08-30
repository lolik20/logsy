import { notFound } from "next/navigation";
import { RouteModal } from "@/components/RouteModal";
import {
  CombinedVisitView,
  parseCombinedQuery,
} from "../../combined/CombinedVisitView";

export const dynamic = "force-dynamic";

// Перехват маршрута logging/combined: при клике по сессии в списке события
// пользователя открываются модалкой поверх текущей страницы. Прямой заход
// по URL рендерит полную страницу combined/page.tsx.
export default async function CombinedIpModal({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ip?: string; date?: string };
}) {
  const { ip, dateStr } = parseCombinedQuery(searchParams);
  if (!ip) notFound();

  return (
    <RouteModal
      title="Все события пользователя"
      subtitle={
        <>
          IP <span className="font-mono">{ip}</span> · {dateStr}
        </>
      }
    >
      <CombinedVisitView
        projectId={params.id}
        ip={ip}
        dateStr={dateStr}
        variant="modal"
      />
    </RouteModal>
  );
}
