"use client";

import { useState } from "react";

/**
 * Блок кода с кнопкой «Скопировать» в углу — для примеров запросов и ответов в
 * документации API. Кнопка появляется всегда (на мобильных наведения нет).
 */
export function CopyCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const ta = document.createElement("textarea");
        ta.value = code;
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
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 pr-24 text-xs leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {code}
      </pre>
      <button
        type="button"
        onClick={copy}
        className={`absolute right-2 top-2 rounded-md border bg-white/80 px-2 py-1 text-[11px] font-medium backdrop-blur transition-colors dark:bg-slate-900/70 ${
          copied
            ? "border-emerald-400 text-emerald-600"
            : "border-slate-300 text-slate-500 hover:border-brand hover:text-brand dark:border-slate-700 dark:text-slate-300"
        }`}
      >
        {copied ? "Скопировано" : "Скопировать"}
      </button>
    </div>
  );
}
