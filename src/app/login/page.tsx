import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, yandexEnabled } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center text-2xl font-bold text-brand">
          Logsy
        </Link>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold">Вход</h1>
          <LoginForm yandexEnabled={yandexEnabled} />
          <p className="mt-6 text-center text-sm text-slate-500">
            Нет аккаунта?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
