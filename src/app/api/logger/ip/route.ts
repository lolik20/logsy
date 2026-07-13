// Определение публичного IP пользователя нашими силами (без сторонних сервисов).
// Клиентский SDK делает GET-запрос с сайта клиента (cross-origin) и получает свой IP.
//
// Ответ содержит только IP самого вызывающего — чувствительных данных нет, поэтому
// разрешаем любой Origin (Access-Control-Allow-Origin: *). Запрос простой (GET без
// кастомных заголовков), preflight не требуется, но OPTIONS обрабатываем на всякий.

import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Max-Age": "86400",
    },
  });
}

export async function GET(req: Request) {
  return NextResponse.json({ ip: getClientIp(req) }, { headers: CORS });
}
