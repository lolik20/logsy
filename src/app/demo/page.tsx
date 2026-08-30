// Демо клиентского пути: от вставки скрипта до починенной ошибки, по шагам.
//
// Вся страница работает на демонстрационных данных внутри клиентского компонента
// DemoJourney: ни одно действие посетителя ничего не пишет в базу и не отправляет
// на сервер — интерактив (плеер записи, «жалоба → задача») живёт в локальном стейте.

import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import { DemoJourney } from "./DemoJourney";

export const metadata: Metadata = {
  title: "Как работает Logsy: демо от сбоя до починки за 7 шагов",
  description:
    "Как работает Logsy, по шагам: одна строка в <head>, алерт о сбое за 60 секунд, запись сессии как видео, стектрейс, жалоба клиента и задача на доске. Всё на демо-данных.",
  alternates: { canonical: "/demo" },
};

export default async function DemoPage() {
  const session = await auth();

  return (
    <main className="relative min-h-screen overflow-x-clip">
      {/* Парящие градиентные пятна на фоне — как на остальных посадочных */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-brand/30 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10rem] top-40 h-[28rem] w-[28rem] rounded-full bg-sky-400/20 blur-3xl"
      />

      <LandingNav authed={!!session} />
      <DemoJourney />
      <LandingFooter />
    </main>
  );
}
