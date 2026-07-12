import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";

async function ownedMonitor(userId: string, id: string) {
  const monitor = await prisma.monitor.findUnique({
    where: { id },
    include: { project: { select: { userId: true } } },
  });
  if (!monitor || monitor.project.userId !== userId) return null;
  return monitor;
}

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
  url: z.string().url("Некорректный URL").optional(),
  // Порт необязателен: пустое значение сбрасывает на стандартный (80/443).
  port: z.preprocess(
    (v) => (v === "" ? null : v),
    z.coerce.number().int().min(1).max(65535).nullable().optional(),
  ),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
  interval: z.enum(["1m", "1h", "1d"]).optional(),
  expectedStatus: z.coerce.number().int().min(100).max(599).optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).optional(),
  headers: z.record(z.string()).optional(),
  bodyType: z.enum(["NONE", "JSON", "XML", "FORM"]).optional(),
  body: z.string().max(20000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const monitor = await ownedMonitor(userId, params.id);
  if (!monitor) return NextResponse.json({ error: "Монитор не найден" }, { status: 404 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Некорректные данные" },
      { status: 400 },
    );
  }

  const { headers, body, name, ...rest } = parsed.data;

  // headers приходят объектом — сохраняем как JSON-строку (или null, если пусто).
  let headersValue: string | null | undefined = undefined;
  if (headers !== undefined) {
    const clean = Object.fromEntries(
      Object.entries(headers).filter(([k]) => k.trim() !== ""),
    );
    headersValue = Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
  }

  const updated = await prisma.monitor.update({
    where: { id: params.id },
    data: {
      ...rest,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(headersValue !== undefined ? { headers: headersValue } : {}),
      ...(body !== undefined ? { body: body.trim() ? body : null } : {}),
    },
  });
  return NextResponse.json({ monitor: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const monitor = await ownedMonitor(userId, params.id);
  if (!monitor) return NextResponse.json({ error: "Монитор не найден" }, { status: 404 });

  await prisma.monitor.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
