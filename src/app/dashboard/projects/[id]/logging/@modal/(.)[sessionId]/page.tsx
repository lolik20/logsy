import { RouteModal } from "@/components/RouteModal";
import { SessionView } from "../../[sessionId]/SessionView";

export const dynamic = "force-dynamic";

// Перехват маршрута logging/[sessionId]: при клике по ссылке на сессию
// (метка сессии в общем списке событий, топ проблем и т.п.) она открывается
// модалкой поверх текущей страницы. Прямой заход по URL рендерит полную
// страницу [sessionId]/page.tsx.
export default async function SessionModalPage({
  params,
}: {
  params: { id: string; sessionId: string };
}) {
  return (
    <RouteModal title="Сессия">
      <SessionView
        projectId={params.id}
        sessionId={params.sessionId}
        variant="modal"
      />
    </RouteModal>
  );
}
