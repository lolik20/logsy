// Отписка от рассылки. Ссылка стоит в футере письма и в заголовке List-Unsubscribe.
// GET  — открывает страницу-подтверждение и отписывает адрес.
// POST — one-click отписка (RFC 8058, List-Unsubscribe-Post) от почтового клиента.
// Отписываем адрес по всем обходам, чтобы он больше не получал писем.

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Отписывает адрес по токену (по всем его письмам). Возвращает email или null. */
async function unsubscribeByToken(token: string): Promise<string | null> {
  const rec = await prisma.scanOutreach.findUnique({
    where: { token },
    select: { toEmail: true },
  });
  if (!rec) return null;
  await prisma.scanOutreach.updateMany({
    where: { toEmail: rec.toEmail },
    data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
  });
  return rec.toEmail;
}

function page(title: string, body: string): Response {
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#eef2f7;">
  <div style="max-width:460px;margin:80px auto;background:#fff;border-radius:16px;padding:32px;text-align:center;">
    <div style="display:inline-flex;width:40px;height:40px;align-items:center;justify-content:center;border-radius:10px;background:#4f46e5;color:#fff;font-weight:800;font-size:18px;">L</div>
    <h1 style="font-size:20px;color:#0f172a;margin:18px 0 8px;">${title}</h1>
    <p style="font-size:14px;color:#64748b;line-height:1.6;margin:0;">${body}</p>
    <a href="https://logsy.ru" style="display:inline-block;margin-top:22px;color:#4f46e5;text-decoration:none;font-weight:600;">logsy.ru</a>
  </div>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const email = await unsubscribeByToken(params.token);
  if (!email) {
    return page("Ссылка недействительна", "Возможно, вы уже отписались или ссылка устарела.");
  }
  return page(
    "Вы отписались",
    `Адрес <b>${email.replace(/</g, "&lt;")}</b> больше не будет получать письма Logsy. Спасибо!`,
  );
}

export async function POST(_req: Request, { params }: { params: { token: string } }) {
  await unsubscribeByToken(params.token);
  // One-click отписка ожидает просто 200 OK.
  return new Response(null, { status: 200 });
}
