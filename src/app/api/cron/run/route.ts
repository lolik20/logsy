import { NextResponse } from "next/server";
import { runDueChecks } from "@/lib/checker";

// Ручной/внешний запуск прогона проверок (альтернатива фоновому воркеру).
// Защита секретным токеном: заголовок  Authorization: Bearer <CRON_SECRET>
// или query-параметр ?token=<CRON_SECRET>.
export const dynamic = "force-dynamic";

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  const provided = auth?.replace(/^Bearer\s+/i, "") || token;
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Запрещено" }, { status: 403 });
  }

  const checked = await runDueChecks();
  return NextResponse.json({ ok: true, checked });
}

export const GET = handle;
export const POST = handle;
