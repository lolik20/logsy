"use client";

import { useState } from "react";

// Данные события для копирования: страница, метод и URL запроса, тело запроса,
// ответ сервера и его статус. Любое поле может отсутствовать.
export type CopyEventData = {
  message?: string | null; // текст ошибки/сообщения (для JS-ошибок без запроса)
  page?: string | null; // URL страницы, где произошло событие
  method?: string | null; // HTTP-метод запроса
  requestUrl?: string | null; // URL/маршрут запроса
  reqBody?: string | null; // тело запроса (payload), если есть
  resBody?: string | null; // тело ответа сервера, если есть
  statusCode?: number | null; // статус ответа
};

/** Собирает читаемый текст для буфера обмена из данных события. */
export function buildCopyText(d: CopyEventData): string {
  const lines: string[] = [];
  const reqLine = [d.method, d.requestUrl].filter(Boolean).join(" ").trim();
  if (d.message && !reqLine) lines.push(`Ошибка: ${d.message}`);
  if (d.page) lines.push(`Страница: ${d.page}`);
  if (reqLine) lines.push(`Запрос: ${reqLine}`);
  if (d.reqBody) lines.push(`Тело запроса: ${d.reqBody}`);
  if (d.resBody != null || d.statusCode != null) {
    const status = d.statusCode != null ? ` (${d.statusCode})` : "";
    lines.push(`Ответ${status}${d.resBody ? `: ${d.resBody}` : ""}`);
  }
  return lines.join("\n");
}

/**
 * Кнопка «Скопировать» напротив ошибки: копирует в буфер страницу, метод и URL
 * запроса, тело запроса (если есть) и ответ сервера со статусом. Используется в
 * блоке «Топ 10 ошибок» и в ленте событий сессии.
 */
export function CopyEventButton({
  data,
  className = "",
}: {
  data: CopyEventData;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    // Строки топа/событий — часто ссылки: не переходим по ним при копировании.
    e.preventDefault();
    e.stopPropagation();
    const text = buildCopyText(data);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* буфер недоступен — тихо игнорируем */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title="Скопировать: страница, запрос и ответ сервера"
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
        copied
          ? "border-emerald-400 text-emerald-600"
          : "border-slate-300 text-slate-500 hover:border-brand hover:text-brand dark:border-slate-700"
      } ${className}`}
    >
      {copied ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
      {copied ? "Скопировано" : "Скопировать"}
    </button>
  );
}
