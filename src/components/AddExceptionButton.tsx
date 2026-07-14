"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  KIND_LABEL,
  URL_MODE_LABEL,
  defaultExceptionUrl,
  eventKind,
  type ExceptionKind,
  type UrlMode,
} from "@/lib/exceptions";

/**
 * Кнопка «В исключения» напротив события лога. По клику открывает модалку с уже
 * заполненными из события параметрами правила — категорией (медленный запрос / ошибка)
 * и условием по URL (содержит / равно). Пользователь может поправить их и сохранить:
 * новые подходящие события перестают сохраняться во всём проекте. Уже записанные
 * события остаются. Снять правило можно в блоке «Исключения» над списком сессий.
 */
export function AddExceptionButton({
  projectId,
  eventType,
  route,
  url,
  excluded,
}: {
  projectId: string;
  eventType: string;
  route: string | null;
  url: string | null;
  excluded: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultKind = eventKind(eventType);
  // Кнопку показываем только для событий, которые вообще можно исключить.
  if (!defaultKind) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={
          excluded
            ? "Событие уже подходит под правило-исключение. Открыть, чтобы добавить ещё одно"
            : "Больше не сохранять такие события во всём проекте"
        }
        className={`whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium ${
          excluded
            ? "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700"
            : "border-slate-300 hover:border-amber-400 hover:text-amber-600 dark:border-slate-700"
        }`}
      >
        {excluded ? "В исключениях" : "В исключения"}
      </button>
      {open && (
        <ExceptionModal
          projectId={projectId}
          defaultKind={defaultKind}
          defaultUrl={defaultExceptionUrl({ route, url })}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const KINDS: ExceptionKind[] = ["SLOW_REQUEST", "ERROR"];
const URL_MODES: UrlMode[] = ["CONTAINS", "EQUALS"];

/** Модалка с параметрами правила-исключения, забитыми из карточки события. */
function ExceptionModal({
  projectId,
  defaultKind,
  defaultUrl,
  onClose,
  onSaved,
}: {
  projectId: string;
  defaultKind: ExceptionKind;
  defaultUrl: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<ExceptionKind>(defaultKind);
  const [urlMode, setUrlMode] = useState<UrlMode>("EQUALS");
  const [url, setUrl] = useState(defaultUrl);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = url.trim();
    if (!value) {
      setError("Укажите URL");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/logger/exceptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ projectId, kind, urlMode, url: value }),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
    } else {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Не удалось добавить в исключения");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold">Добавить в исключения</h3>
        <p className="mt-1 text-xs text-slate-500">
          События, подходящие под правило, перестанут сохраняться во всём проекте.
          Уже записанные события останутся.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-600 dark:text-slate-300">
          Тип
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as ExceptionKind)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-sm font-medium text-slate-600 dark:text-slate-300">
          URL
        </label>
        <div className="mt-1 flex gap-2">
          <select
            value={urlMode}
            onChange={(e) => setUrlMode(e.target.value as UrlMode)}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
          >
            {URL_MODES.map((m) => (
              <option key={m} value={m}>
                {URL_MODE_LABEL[m]}
              </option>
            ))}
          </select>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="/api/example"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-800"
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          «равно» — точное совпадение пути запроса (без query). «содержит» — URL
          события содержит указанную подстроку.
        </p>

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium disabled:opacity-60 dark:border-slate-700"
          >
            Отмена
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {saving ? "Сохранение…" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
