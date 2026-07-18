"use client";

import { useCallback, useEffect, useState } from "react";

// Карточка статуса подключения SDK на сайте проекта. При монтировании (и по кнопке
// «Проверить снова») запрашивает /api/projects/{id}/sdk-check — сервер делает запрос на
// сайт клиента и ищет тег скрипта в <head> главной страницы. Показывает один из статусов:
// проверяем / подключён / не подключён / сайт недоступен. Проверка идёт асинхронно, поэтому
// не блокирует загрузку страницы логирования.

type CheckState =
  | { status: "loading" }
  | { status: "connected"; checkedUrl: string }
  | { status: "missing"; checkedUrl: string }
  | { status: "error"; message: string; checkedUrl: string };

// compact — краткий вид для вкладки «Логирование»: без пояснений, показываем баннер только
// когда скрипт не найден / проверить не удалось (подключённый скрипт не отвлекает).
export function SdkStatusCard({
  projectId,
  compact = false,
}: {
  projectId: string;
  compact?: boolean;
}) {
  const [state, setState] = useState<CheckState>({ status: "loading" });

  const check = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const res = await fetch(`/api/projects/${projectId}/sdk-check`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data.error || "Не удалось проверить", checkedUrl: "" });
        return;
      }
      const checkedUrl = data.checkedUrl || "";
      if (data.error) {
        setState({ status: "error", message: data.error, checkedUrl });
      } else if (data.connected) {
        setState({ status: "connected", checkedUrl });
      } else {
        setState({ status: "missing", checkedUrl });
      }
    } catch {
      setState({ status: "error", message: "Не удалось проверить", checkedUrl: "" });
    }
  }, [projectId]);

  useEffect(() => {
    check();
  }, [check]);

  // В компактном режиме подключённый скрипт не показываем — только предупреждения.
  if (compact && state.status === "connected") return null;
  if (compact && state.status === "loading") return null;

  const recheckBtn = (
    <button
      type="button"
      onClick={check}
      disabled={state.status === "loading"}
      className="whitespace-nowrap rounded-lg border border-current px-2.5 py-1 text-xs font-medium hover:opacity-70 disabled:opacity-60"
    >
      {state.status === "loading" ? "Проверка…" : "Проверить снова"}
    </button>
  );

  if (state.status === "loading") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        Проверяем подключение скрипта на сайте…
      </div>
    );
  }

  if (state.status === "connected") {
    return (
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Скрипт SDK подключён на сайте — логи собираются.
        </span>
        {recheckBtn}
      </div>
    );
  }

  if (state.status === "missing") {
    return (
      <>
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Скрипт SDK не найден на сайте
            </span>
            {recheckBtn}
          </div>
          {!compact && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300/80">
              Мы запросили{" "}
              {state.checkedUrl && <span className="font-mono">{state.checkedUrl}</span>}, но не
              нашли тег скрипта в <code className="font-mono">&lt;head&gt;</code>. Вставьте тег из
              блока ниже и проверьте снова.
            </p>
          )}
        </div>
        {!compact && <ConnectHelpCard />}
      </>
    );
  }

  // error
  return (
    <>
      <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 font-medium">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Не удалось проверить подключение: {state.message}
          </span>
          {recheckBtn}
        </div>
      </div>
      {!compact && <ConnectHelpCard />}
    </>
  );
}

// Блок помощи: показывается на вкладке «Подключение», когда скрипт ещё не подключён.
// Предлагает бесплатное подключение силами команды через менеджера в Telegram.
function ConnectHelpCard() {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand-50 px-5 py-4 dark:border-brand/30 dark:bg-brand/10">
      <div>
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Возникли проблемы с подключением?
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          Напишите менеджеру в Telegram — подключим скрипт на сайт бесплатно.
        </p>
      </div>
      <a
        href="https://telegram.me/tritex_manager"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c86ba]"
      >
        <TelegramIcon className="h-4 w-4" />
        Запросить бесплатное подключение
      </a>
    </div>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M21.94 4.6 18.7 19.86c-.24 1.08-.88 1.34-1.79.84l-4.94-3.64-2.38 2.29c-.26.26-.48.48-.99.48l.35-5.02 9.13-8.25c.4-.35-.09-.55-.62-.2L5.19 13.02.34 11.5c-1.05-.33-1.07-1.05.22-1.56L20.58 2.2c.88-.33 1.65.2 1.36 2.4Z" />
    </svg>
  );
}
