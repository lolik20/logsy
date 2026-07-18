import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

const schema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1, "Укажите название").max(120),
  url: z.string().url("Некорректный URL"),
  // Порт необязателен: если не задан, используется 80 (http) или 443 (https).
  port: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().min(1).max(65535).nullable().optional(),
  ),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  interval: z.enum(["1m", "1h", "1d"]),
  expectedStatus: z.coerce.number().int().min(100).max(599).default(200),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(10000),
  headers: z.record(z.string()).optional(),
  bodyType: z.enum(["NONE", "JSON", "XML", "FORM"]).default("NONE"),
  body: z.string().max(20000).optional(),
});

export async function POST(req: Request) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: parsed.data.projectId },
  });
  if (!project || project.userId !== userId) {
    return NextResponse.json({ error: "Сайт не найден" }, { status: 404 });
  }

  // Оставляем только непустые заголовки; сохраняем как JSON-строку.
  const cleanHeaders = Object.fromEntries(
    Object.entries(parsed.data.headers ?? {}).filter(
      ([k, v]) => k.trim() !== "" && v !== undefined,
    ),
  );
  const headers =
    Object.keys(cleanHeaders).length > 0 ? JSON.stringify(cleanHeaders) : null;

  const monitor = await prisma.monitor.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name.trim(),
      url: parsed.data.url,
      port: parsed.data.port ?? null,
      method: parsed.data.method,
      interval: parsed.data.interval,
      expectedStatus: parsed.data.expectedStatus,
      timeoutMs: parsed.data.timeoutMs,
      headers,
      bodyType: parsed.data.bodyType,
      body: parsed.data.body?.trim() ? parsed.data.body : null,
    },
  });

  return NextResponse.json({ monitor });
}
