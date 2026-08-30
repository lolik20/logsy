import { SessionView } from "./SessionView";

export const dynamic = "force-dynamic";

// Полная страница сессии — для прямого захода по URL (например, из письма-алерта).
// При переходе по ссылке внутри приложения этот маршрут перехватывается
// и открывается модалкой (см. ../@modal/(.)[sessionId]/page.tsx).
export default async function SessionPage({
  params,
}: {
  params: { id: string; sessionId: string };
}) {
  return (
    <SessionView
      projectId={params.id}
      sessionId={params.sessionId}
      variant="page"
    />
  );
}
