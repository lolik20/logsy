import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ForgotPasswordForm } from "@/components/ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-brand">
          Logsy
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold">Восстановление пароля</h1>
          <p className="mt-1 text-sm text-slate-500">
            Укажите email — пришлём ссылку для сброса пароля.
          </p>
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-sm text-slate-500">
            Вспомнили пароль?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
