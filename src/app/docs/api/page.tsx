// Публичная документация API — открыта для индексации и для чтения ИИ-агентом.
// Ключ проекта здесь не показывается: он выдаётся в панели, на вкладке «API».

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { CopyCodeBlock } from "@/components/CopyCodeBlock";
import { API_ENDPOINTS, appUrl } from "@/lib/api-docs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Документация API: сессии и события сайта в JSON, OpenAPI",
  description:
    "Документация API Logsy: сессии посетителей сайта, ошибки JavaScript со стектрейсом, упавшие и медленные запросы. Авторизация ключом проекта, ответы в JSON, OpenAPI-спецификация.",
  alternates: { canonical: "/docs/api" },
  openGraph: {
    title: "Документация публичного HTTP-API: сессии и события сайта",
    description:
      "Сессии и события сайта в JSON: ошибки, упавшие запросы, действия посетителя. Ключ проекта, OpenAPI, llms.txt для ИИ-агентов.",
    type: "article",
  },
};

export default async function ApiDocsPage() {
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
          / Документация API
        </nav>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Документация публичного API</h1>
        <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
          Публичное HTTP-API отдаёт то же, что вы видите в панели: сессии посетителей сайта и
          все их события — ошибки JavaScript со стектрейсом, упавшие и медленные запросы с
          телом и заголовками, переходы, клики и обращения из формы «Сообщить об ошибке».
          Методы только на чтение, ответ всегда JSON.
        </p>

        {/* Авторизация */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Авторизация</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Каждый проект имеет свой ключ — он выпускается автоматически и лежит в панели на
            вкладке «API». Ключ передаётся заголовком, любым из двух способов:
          </p>
          <CopyCodeBlock code={`Authorization: Bearer $LOGSY_API_KEY\n# или\nX-Api-Key: $LOGSY_API_KEY`} />
          <p className="mt-3 text-sm text-slate-500">
            Ключ открывает доступ ко всем логам сайта, поэтому запросы делаются с сервера или
            из локального окружения — в браузер его отдавать нельзя. Базовый адрес:
          </p>
          <CopyCodeBlock code={`${base}/api/v1`} />
        </section>

        {/* Методы */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Методы</h2>
          <div className="mt-4 grid gap-3">
            {API_ENDPOINTS.map((e) => (
              <Link
                key={e.slug}
                href={`/docs/api/${e.slug}`}
                className="group rounded-xl border border-slate-200 bg-white/70 p-5 transition hover:border-brand dark:border-slate-800 dark:bg-slate-900/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand-50 px-2 py-0.5 font-mono text-xs font-semibold text-brand dark:bg-brand/10">
                    {e.method}
                  </span>
                  <span className="font-mono text-sm text-slate-700 dark:text-slate-200">{e.path}</span>
                </div>
                <h3 className="mt-2 font-semibold group-hover:text-brand">{e.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{e.summary}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Машиночитаемое */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Для ИИ-агентов и генераторов клиентов</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Спецификация и карта сервиса открыты — агенту достаточно дать ссылку и ключ
            проекта, обвязку писать не нужно.
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <a href="/api/v1/openapi.json" className="font-mono text-brand hover:underline">
                /api/v1/openapi.json
              </a>{" "}
              — OpenAPI 3.1
            </li>
            <li>
              <a href="/llms.txt" className="font-mono text-brand hover:underline">
                /llms.txt
              </a>{" "}
              — краткая карта сервиса для языковых моделей
            </li>
            <li>
              <Link href="/docs/for-agents" className="text-brand hover:underline">
                Как подключить Logsy к Claude Code и Cursor
              </Link>
            </li>
          </ul>
        </section>

        {/* Лимиты и хранение */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Лимиты и хранение</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li>Данные доступны в пределах срока хранения логов по тарифу проекта — всё, что старше, удаляется и через API не вернётся.</li>
            <li>Список сессий отдаёт до 200 записей за запрос, дальше — через <span className="font-mono">offset</span>.</li>
            <li>Чанки записи экрана через API не отдаются: приходит только признак наличия записи и их количество.</li>
          </ul>
        </section>

        <div className="mt-12 rounded-2xl bg-brand-50 p-6 dark:bg-brand/10">
          <h2 className="text-lg font-semibold">Нужен ключ</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Заведите сайт в Logsy — ключ появится на вкладке «API» вместе с одной строкой
            скрипта для подключения логирования.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-light px-5 py-2.5 font-semibold text-white"
          >
            Подключить сайт
          </Link>
        </div>
      </div>

      <LandingFooter />
    </main>
  );
}
