import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { SpeedTestForm } from "@/components/SpeedTestForm";

export const metadata: Metadata = {
  title: "Проверить скорость сайта онлайн — Logsy",
  description:
    "Бесплатный онлайн-инструмент: узнайте скорость загрузки сайта по URL — время до первого байта, полное время загрузки и размер ответа.",
};

const steps = [
  {
    title: "Открываем в реальном браузере",
    text: "Не просто пингуем — грузим страницу в Chromium и выполняем все скрипты, как у обычного посетителя.",
    icon: "🌐",
  },
  {
    title: "Готовность DOM со скриптами",
    text: "Замеряем время до момента, когда страница действительно готова к работе — с учётом JS.",
    icon: "⚡",
  },
  {
    title: "TTFB, запросы и полная загрузка",
    text: "Показываем первый байт, число запросов и полное время загрузки — сразу видно, что тормозит.",
    icon: "⏱️",
  },
];

export default async function SpeedTestPage() {
  const session = await auth();

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Парящие градиентные пятна на фоне */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-sky-400/20 blur-3xl"
      />

      <LandingNav authed={!!session} />

      {/* Hero + инструмент */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-16 pt-16">
        <div className="text-center">
          <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand dark:bg-brand/10">
            Бесплатный онлайн-инструмент
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Ваш сайт{" "}
            <span className="bg-gradient-to-r from-brand to-sky-500 bg-clip-text text-transparent">
              тормозит
            </span>
            ? Проверьте за 5 секунд
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600 dark:text-slate-300">
            Медленный сайт молча теряет клиентов и деньги. Введите адрес — покажем
            реальную скорость загрузки и сколько ждёт ваш посетитель.
          </p>
        </div>

        <div className="mt-10">
          <SpeedTestForm />
        </div>
      </section>

      {/* Что мы измеряем */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div
              key={s.title}
              className="rounded-2xl border border-white/50 bg-white/60 p-6 shadow-card backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-brand-100 text-2xl dark:from-brand/20 dark:to-brand/10">
                {s.icon}
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800">
        <p>© {new Date().getFullYear()} Logsy — мониторинг доступности сайтов.</p>
      </footer>
    </main>
  );
}
