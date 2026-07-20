// Трекинг открытия письма рассылки. В HTML-письме стоит <img src=".../api/track/open/<token>.png">.
// При загрузке пикселя отмечаем открытие в ScanOutreach и всегда отдаём прозрачный 1×1 GIF.
// Публичный роут (без авторизации) — его дёргает почтовый клиент получателя.

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Прозрачный GIF 1×1.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(): Response {
  return new Response(PIXEL, {
    status: 200,
    headers: {
      "content-type": "image/gif",
      "content-length": String(PIXEL.length),
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      pragma: "no-cache",
      expires: "0",
    },
  });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  // В URL токен идёт с расширением .png — отбрасываем его.
  const token = params.token.replace(/\.(png|gif|jpg)$/i, "");
  try {
    const rec = await prisma.scanOutreach.findUnique({ where: { token }, select: { id: true } });
    if (rec) {
      const now = new Date();
      await prisma.scanOutreach.update({
        where: { id: rec.id },
        data: { openCount: { increment: 1 }, lastOpenedAt: now },
      });
      // Проставляем firstOpenedAt только при первом открытии.
      await prisma.scanOutreach.updateMany({
        where: { id: rec.id, firstOpenedAt: null },
        data: { firstOpenedAt: now },
      });
    }
  } catch {
    /* трекинг не должен ломать отдачу пикселя */
  }
  return pixelResponse();
}
