import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { consumeContactVerificationToken } from "@/lib/contact-verification";

export const dynamic = "force-dynamic";

// Страница подтверждения email-канала уведомлений. Открывается по ссылке из письма:
// сжигает токен и проставляет verified=true у контакта. Показывает результат.
export default async function VerifyContactPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = (searchParams?.token ?? "").trim();
  const contactId = await consumeContactVerificationToken(token);

  let ok = false;
  let email: string | null = null;
  if (contactId) {
    const contact = await prisma.contact.findUnique({ where: { id: contactId } });
    if (contact) {
      await prisma.contact.update({ where: { id: contactId }, data: { verified: true } });
      ok = true;
      email = contact.value;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-brand">
          Logsy
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {ok ? (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl dark:bg-emerald-900/40">
                ✅
              </div>
              <h1 className="text-xl font-semibold">Email подтверждён</h1>
              <p className="mt-2 text-sm text-slate-500">
                {email ? (
                  <>
                    Адрес <span className="font-medium">{email}</span> подтверждён — теперь на
                    него будут приходить алерты Logsy.
                  </>
                ) : (
                  "Адрес подтверждён — теперь на него будут приходить алерты Logsy."
                )}
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-900/40">
                ⚠️
              </div>
              <h1 className="text-xl font-semibold">Ссылка недействительна</h1>
              <p className="mt-2 text-sm text-slate-500">
                Ссылка подтверждения устарела или уже использована. Отправьте письмо
                повторно из вкладки «Алерты».
              </p>
            </>
          )}
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            В личный кабинет
          </Link>
        </div>
      </div>
    </main>
  );
}
