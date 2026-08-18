// Машиночитаемая спецификация публичного API (OpenAPI 3.1).
// Отдаётся без авторизации: это описание методов, а не данные. По ней ИИ-агенты и
// генераторы клиентов понимают контракт без чтения HTML-документации.

import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/api-docs";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(openApiSpec(), {
    headers: {
      // Спецификацию можно читать откуда угодно — она публична.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
