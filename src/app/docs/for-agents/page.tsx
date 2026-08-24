// Страница для тех, кто пишет код с ИИ-агентом: как отдать агенту ошибки прода.
// Индексируется поисковиками и одновременно служит инструкцией для самого агента —
// он может прочитать её по ссылке и сразу начать ходить в API.

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { CopyCodeBlock } from "@/components/CopyCodeBlock";
import { appUrl } from "@/lib/api-docs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ошибки прода для ИИ-агента: подключить Claude Code и Cursor",
  description:
    "Как подключить Logsy к ИИ-агенту: ключ проекта, OpenAPI, llms.txt и готовые запросы. Агент видит стектрейс ошибки, упавший запрос с телом и шаги пользователя до сбоя.",
  alternates: { canonical: "/docs/for-agents" },
  openGraph: {
    title: "Ошибки прода для ИИ-агента: ключ проекта, OpenAPI и llms.txt",
    description:
      "Ключ проекта, OpenAPI и llms.txt — агент сам забирает сессии и ошибки прода и чинит по фактам, а не по скриншоту.",
    type: "article",
  },
};

export default async function ForAgentsPage() {
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
          / Для ИИ-агентов
        </nav>

        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          Отдайте агенту то, что реально сломалось у пользователя
        </h1>
        <p className="mt-4 max-w-2xl text-slate-600 dark:text-slate-300">
          Обычный цикл: пользователь пишет «у меня не работает», вы пересказываете это агенту,
          агент гадает. С Logsy агент получает факты — стектрейс ошибки, упавший запрос с телом
          и заголовками, шаги посетителя до сбоя. Данные лежат за обычным HTTP-API с ключом
          проекта, поэтому подключается любой агент: Claude Code, Cursor, ваш собственный.
        </p>

        {/* Шаг 1 */}
        <section className="mt-12">
          <h2 className="text-xl font-semibold">1. Подключите сайт</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Заведите проект в панели и поставьте одну строку в <span className="font-mono">&lt;head&gt;</span>{" "}
            сайта — SDK начнёт писать ошибки, сетевые сбои и действия посетителей.
          </p>
          <CopyCodeBlock code={`<script src="${base}/api/logger/sdk" defer></script>`} />
        </section>

        {/* Шаг 2 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">2. Возьмите ключ проекта</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ключ лежит в панели на вкладке «API». Положите его в переменную окружения — агент
            подхватит её из вашего окружения и не будет светить ключ в переписке.
          </p>
          <CopyCodeBlock code={`export LOGSY_API_KEY="lg_…"\nexport LOGSY_URL="${base}"`} />
        </section>

        {/* Шаг 3 */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">3. Дайте агенту адрес документации</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Агенту достаточно одной ссылки: по ней он поймёт, какие есть методы и что они
            возвращают. Обвязку писать не нужно.
          </p>
          <CopyCodeBlock
            code={`Документация: ${base}/llms.txt\nOpenAPI: ${base}/api/v1/openapi.json`}
          />
          <p className="mt-3 text-sm text-slate-500">
            В Claude Code это выглядит как одна фраза в чате: «возьми ошибки за сегодня из
            Logsy — ключ в LOGSY_API_KEY, документация на {base.replace(/^https?:\/\//, "")}/llms.txt».
          </p>
        </section>

        {/* Готовые запросы */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Готовые запросы</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Найти сессии с ошибками за сегодня, а потом развернуть проблемную целиком:
          </p>
          <CopyCodeBlock
            code={`# сессии за сутки со счётчиками ошибок
curl -s -H "Authorization: Bearer $LOGSY_API_KEY" \\
  "$LOGSY_URL/api/v1/sessions?date=$(date -u +%F)&limit=100" \\
  | jq '.sessions[] | select(.events.errors > 0) | {id, startedAt, errors: .events.errors}'

# всё, что произошло в конкретной сессии
curl -s -H "Authorization: Bearer $LOGSY_API_KEY" \\
  "$LOGSY_URL/api/v1/sessions/<id>" \\
  | jq '.events[] | select(.type == "ERROR" or .type == "HTTP_ERROR")'`}
          />
        </section>

        {/* Что получит агент */}
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Что именно увидит агент</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Ошибку с местом в коде", "Сообщение и стектрейс: файл, строка, функция — сразу видно, куда смотреть."],
              ["Упавший запрос целиком", "Метод, адрес, код ответа, время, тело запроса и ответа. Пароли маскируются на клиенте."],
              ["Шаги до сбоя", "Переходы, клики и ввод перед ошибкой — готовые шаги воспроизведения."],
              ["Контекст посетителя", "Браузер, устройство, страна, метки перехода — понятно, у кого именно ломается."],
            ].map(([title, text]) => (
              <div
                key={title}
                className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-sm text-slate-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-slate-200">
          <b>Про безопасность.</b> Ключ проекта открывает доступ ко всем логам сайта. Держите
          его в переменной окружения, не коммитьте в репозиторий и не вставляйте в код,
          который выкатывается в браузер. Если ключ утёк — перевыпустите его в панели, старый
          перестанет работать сразу.
        </section>

        <div className="mt-12 rounded-2xl bg-brand-50 p-6 dark:bg-brand/10">
          <h2 className="text-lg font-semibold">Подключить за пару минут</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Бесплатный тариф навсегда: одна строка скрипта, ключ в панели — и агент видит
            прод глазами пользователя.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/register"
              className="rounded-xl bg-gradient-to-r from-brand to-brand-light px-5 py-2.5 font-semibold text-white"
            >
              Подключить сайт
            </Link>
            <Link
              href="/docs/api"
              className="rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200"
            >
              Документация API
            </Link>
          </div>
        </div>
      </div>

      <LandingFooter />
    </main>
  );
}
