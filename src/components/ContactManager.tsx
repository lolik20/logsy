"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contact = { id: string; type: string; value: string; verified: boolean };

export function ContactManager({
  contacts,
  botLink,
}: {
  contacts: Contact[];
  botLink: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [chatId, setChatId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState<"email" | "telegram" | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  async function add(
    type: "EMAIL" | "TELEGRAM",
    value: string,
    onDone: () => void,
  ) {
    setError(null);
    setNotice(null);
    setLoading(type === "EMAIL" ? "email" : "telegram");
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    setLoading(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось добавить канал");
      return;
    }
    if (data.verificationSent) {
      setNotice(
        `На ${value.trim().toLowerCase()} отправлено письмо со ссылкой. Подтвердите адрес, чтобы получать алерты.`,
      );
    }
    onDone();
    router.refresh();
  }

  async function resend(id: string) {
    setError(null);
    setNotice(null);
    setResendingId(id);
    const res = await fetch(`/api/contacts/${id}/resend-verification`, { method: "POST" });
    setResendingId(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Не удалось отправить письмо");
      return;
    }
    setNotice("Письмо со ссылкой подтверждения отправлено повторно.");
  }

  async function remove(id: string) {
    if (!confirm("Удалить канал?")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="grid gap-8">
      {/* Email */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Email
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add("EMAIL", email, () => setEmail(""));
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            required
            type="email"
            placeholder="email@example.ru"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
          />
          <button
            type="submit"
            disabled={loading === "email"}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loading === "email" ? "Добавляем…" : "Добавить"}
          </button>
        </form>
      </section>

      {/* Telegram */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Telegram
        </h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-500">
          <li>
            Откройте бота и нажмите <b>«Запустить»</b> — он пришлёт ваш chat id.
          </li>
          <li>Скопируйте chat id и вставьте его в поле ниже.</li>
        </ol>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {botLink ? (
            <a
              href={botLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-[#229ED9] px-4 py-2 text-sm font-medium text-white hover:bg-[#1c86ba]"
            >
              <TelegramIcon className="h-4 w-4" />
              Открыть бота
            </a>
          ) : (
            <span className="text-sm text-amber-600">
              Бот не настроен (TELEGRAM_BOT_USERNAME).
            </span>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add("TELEGRAM", chatId, () => setChatId(""));
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <input
            required
            inputMode="numeric"
            placeholder="Chat id, например 123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 bg-transparent px-3 py-2 outline-none focus:border-brand dark:border-slate-700"
          />
          <button
            type="submit"
            disabled={loading === "telegram"}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {loading === "telegram" ? "Добавляем…" : "Добавить"}
          </button>
        </form>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && <p className="text-sm text-emerald-600">{notice}</p>}

      {/* Список подключённых каналов */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Подключённые каналы
        </h2>
        <div className="mt-3 grid gap-2">
          {contacts.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700">
              Пока нет каналов. Добавьте email или подключите Telegram, чтобы
              получать алерты.
            </p>
          )}
          {contacts.map((c) => {
            const unverified = c.type === "EMAIL" && !c.verified;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {c.type === "TELEGRAM" ? (
                    <>
                      <TelegramIcon className="h-4 w-4 text-[#229ED9]" />
                      <span className="truncate">Telegram: {c.value}</span>
                    </>
                  ) : (
                    <span className="truncate">✉️ {c.value}</span>
                  )}
                  {unverified ? (
                    <span
                      className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                      title="Алерты на этот адрес не приходят, пока он не подтверждён"
                    >
                      не подтверждён
                    </span>
                  ) : (
                    c.type === "EMAIL" && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                        подтверждён
                      </span>
                    )
                  )}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {unverified && (
                    <button
                      onClick={() => resend(c.id)}
                      disabled={resendingId === c.id}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-brand hover:text-brand disabled:opacity-60 dark:border-slate-700 dark:text-slate-300"
                    >
                      {resendingId === c.id ? "Отправляем…" : "Отправить письмо повторно"}
                    </button>
                  )}
                  <button
                    onClick={() => remove(c.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-red-400 hover:text-red-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
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
