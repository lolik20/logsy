// Страница одного метода API: /docs/api/sessions, /docs/api/session.
// Отдельная страница на метод — чтобы поисковик индексировал конкретный запрос
// («получить события сессии api»), а агент получал компактный ответ по одной ссылке.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { CopyCodeBlock } from "@/components/CopyCodeBlock";
import { API_ENDPOINTS, appUrl, endpointBySlug, withBase } from "@/lib/api-docs";

export const dynamic = "force-dynamic";

export function generateMetadata({ params }: { params: { method: string } }): Metadata {
  const endpoint = endpointBySlug(params.method);
  if (!endpoint) return { title: "Метод не найден" };
  return {
    title: `${endpoint.method} ${endpoint.path} — документация API`,
    description: endpoint.summary,
    alternates: { canonical: `/docs/api/${endpoint.slug}` },
    openGraph: { title: `${endpoint.method} ${endpoint.path} — документация API`, description: endpoint.summary, type: "article" },
  };
}

export default async function ApiMethodPage({ params }: { params: { method: string } }) {
  const endpoint = endpointBySlug(params.method);
  if (!endpoint) notFound();
  const session = await auth();
  const base = appUrl();

  return (
    <main className="min-h-screen">
      <LandingNav authed={!!session} />

      <div className="mx-auto max-w-4xl px-5 pb-20 pt-10">
        <nav className="text-sm text-slate-500">
          <Link href="/" className="hover:text-brand">
            Logsy
          </Link>{" "}
          /{" "}
          <Link href="/docs/api" className="hover:text-brand">
            API
          </Link>{" "}
          / {endpoint.title}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-brand-50 px-2 py-1 font-mono text-xs font-semibold text-brand dark:bg-brand/10">
            {endpoint.method}
          </span>
          <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{endpoint.path}</span>
        </div>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{endpoint.title}</h1>
        <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">{endpoint.description}</p>

        {/* Что решает */}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Зачем нужен</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            {endpoint.useCases.map((u) => (
              <li key={u} className="flex gap-2">
                <span className="text-brand">→</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Параметры */}
        {endpoint.params.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Параметры</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Параметр</th>
                    <th className="px-4 py-2 font-medium">Тип</th>
                    <th className="px-4 py-2 font-medium">Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoint.params.map((p) => (
                    <tr key={p.name} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                        {p.name}
                        {p.required && <span className="ml-1 text-brand">*</span>}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-slate-500">{p.type}</td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{p.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Запрос */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Пример запроса</h2>
          <p className="mt-2 text-sm text-slate-500">
            Ключ проекта лежит в панели на вкладке «API»; в примере он берётся из переменной
            окружения <span className="font-mono">LOGSY_API_KEY</span>.
          </p>
          <CopyCodeBlock code={withBase(endpoint.curl)} />
        </section>

        {/* Ответ */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Пример ответа</h2>
          <CopyCodeBlock code={endpoint.response} />
        </section>

        {/* Поля */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Поля ответа</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-2 font-medium">Поле</th>
                  <th className="px-4 py-2 font-medium">Тип</th>
                  <th className="px-4 py-2 font-medium">Что значит</th>
                </tr>
              </thead>
              <tbody>
                {endpoint.fields.map((f) => (
                  <tr key={f.name} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">{f.name}</td>
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{f.type}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{f.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ошибки */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Коды ответа</h2>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>
              <span className="font-mono">200</span> — успех, тело в JSON.
            </li>
            <li>
              <span className="font-mono">401</span> — ключ не передан или неверный.
            </li>
            {endpoint.slug === "session" && (
              <li>
                <span className="font-mono">404</span> — сессия не найдена или уже удалена по сроку хранения.
              </li>
            )}
          </ul>
        </section>

        <nav className="mt-12 flex flex-wrap gap-3 border-t border-slate-200 pt-6 text-sm dark:border-slate-800">
          {API_ENDPOINTS.filter((e) => e.slug !== endpoint.slug).map((e) => (
            <Link
              key={e.slug}
              href={`/docs/api/${e.slug}`}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
            >
              {e.method} {e.path}
            </Link>
          ))}
          <a
            href={`${base}/api/v1/openapi.json`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
          >
            OpenAPI-спецификация
          </a>
        </nav>
      </div>

      <LandingFooter />
    </main>
  );
}
