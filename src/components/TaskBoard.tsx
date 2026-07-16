"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskStatus,
} from "@/lib/tasks";

export type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  reporterEmail: string | null;
  sessionId: string | null;
  position: number;
  createdAt: string;
};

// Цветовые акценты колонок (полоска сверху карточки колонки и бейдж статуса).
const COLUMN_ACCENT: Record<TaskStatus, string> = {
  CREATED: "bg-slate-400",
  IN_PROGRESS: "bg-amber-400",
  DONE: "bg-emerald-500",
};

type EditorState =
  | { mode: "create"; status: TaskStatus }
  | { mode: "edit"; task: BoardTask }
  | null;

/**
 * Доска задач проекта (канбан) с тремя колонками-статусами. Задачи можно создавать
 * вручную, редактировать, удалять и перетаскивать между колонками (native HTML5 DnD).
 * Задачи из обратной формы ошибок приходят в колонку «Создано» и помечены значком.
 */
export function TaskBoard({
  projectId,
  tasks: initialTasks,
}: {
  projectId: string;
  tasks: BoardTask[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<BoardTask[]>(initialTasks);
  const [editor, setEditor] = useState<EditorState>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<TaskStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Группируем задачи по колонкам, сортируя по position (меньше — выше), затем по дате.
  const columns = useMemo(() => {
    const byStatus: Record<TaskStatus, BoardTask[]> = {
      CREATED: [],
      IN_PROGRESS: [],
      DONE: [],
    };
    for (const t of tasks) {
      const s = (TASK_STATUSES as readonly string[]).includes(t.status)
        ? (t.status as TaskStatus)
        : "CREATED";
      byStatus[s].push(t);
    }
    for (const s of TASK_STATUSES) {
      byStatus[s].sort(
        (a, b) =>
          a.position - b.position ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }
    return byStatus;
  }, [tasks]);

  // --- Перетаскивание между колонками ---
  async function moveTo(taskId: string, status: TaskStatus) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;
    // Новая позиция — наверх целевой колонки (минимальная позиция минус один).
    const minPos = tasks
      .filter((t) => t.status === status)
      .reduce((m, t) => Math.min(m, t.position), 0);
    const position = minPos - 1;
    const prev = tasks;
    setTasks((ts) =>
      ts.map((t) => (t.id === taskId ? { ...t, status, position } : t)),
    );
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, position }),
    });
    if (!res.ok) {
      setTasks(prev); // откат
      setError("Не удалось переместить задачу");
    } else {
      router.refresh();
    }
  }

  async function remove(taskId: string) {
    if (!confirm("Удалить задачу?")) return;
    const prev = tasks;
    setTasks((ts) => ts.filter((t) => t.id !== taskId));
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!res.ok) {
      setTasks(prev);
      setError("Не удалось удалить задачу");
    } else {
      router.refresh();
    }
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {TASK_STATUSES.map((status) => {
          const list = columns[status];
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setOverCol(status);
              }}
              onDragLeave={(e) => {
                // Сбрасываем подсветку, только когда курсор реально покинул колонку.
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverCol((c) => (c === status ? null : c));
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                if (dragId) moveTo(dragId, status);
                setDragId(null);
              }}
              className={`flex flex-col rounded-2xl border bg-slate-50 p-3 transition-colors dark:bg-slate-900/40 ${
                overCol === status
                  ? "border-brand ring-2 ring-brand/30"
                  : "border-slate-200 dark:border-slate-800"
              }`}
            >
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${COLUMN_ACCENT[status]}`} />
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {TASK_STATUS_LABEL[status]}
                </h3>
                <span className="ml-1 text-xs text-slate-400">{list.length}</span>
                <button
                  type="button"
                  onClick={() => setEditor({ mode: "create", status })}
                  title="Добавить задачу"
                  className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              </div>

              <div className="flex-1 space-y-2">
                {list.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
                    Перетащите задачу сюда
                  </p>
                )}
                {list.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    projectId={projectId}
                    dragging={dragId === task.id}
                    onDragStart={() => setDragId(task.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    onEdit={() => setEditor({ mode: "edit", task })}
                    onDelete={() => remove(task.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editor && (
        <TaskEditor
          projectId={projectId}
          editor={editor}
          onClose={() => setEditor(null)}
          onSaved={(task, isNew) => {
            setTasks((ts) =>
              isNew ? [...ts, task] : ts.map((t) => (t.id === task.id ? task : t)),
            );
            setEditor(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  projectId,
  dragging,
  onDragStart,
  onDragEnd,
  onEdit,
  onDelete,
}: {
  task: BoardTask;
  projectId: string;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition active:cursor-grabbing dark:border-slate-800 dark:bg-slate-900 ${
        dragging ? "opacity-50" : "hover:border-brand/60"
      }`}
    >
      <div className="flex items-start gap-2">
        {task.source === "REPORT" && (
          <span
            title="Из обратной формы ошибок"
            className="mt-0.5 shrink-0 text-violet-500"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
        )}
        <p className="min-w-0 flex-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">
          {task.title}
        </p>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            title="Редактировать"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onDelete}
            title="Удалить"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {task.description && task.description !== task.title && (
        <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-slate-500 dark:text-slate-400">
          {task.description.length > 240
            ? `${task.description.slice(0, 240)}…`
            : task.description}
        </p>
      )}

      {(task.reporterEmail || task.sessionId) && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {task.reporterEmail && (
            <a
              href={`mailto:${task.reporterEmail}`}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-500 hover:text-brand dark:bg-slate-800"
            >
              ✉ {task.reporterEmail}
            </a>
          )}
          {task.sessionId && (
            <Link
              href={`/dashboard/projects/${projectId}/logging/${task.sessionId}`}
              className="hover:text-brand"
            >
              Открыть сессию →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function TaskEditor({
  projectId,
  editor,
  onClose,
  onSaved,
}: {
  projectId: string;
  editor: NonNullable<EditorState>;
  onClose: () => void;
  onSaved: (task: BoardTask, isNew: boolean) => void;
}) {
  const isEdit = editor.mode === "edit";
  const [title, setTitle] = useState(isEdit ? editor.task.title : "");
  const [description, setDescription] = useState(
    isEdit ? (editor.task.description ?? "") : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const t = title.trim();
    if (!t) {
      setErr("Введите название задачи");
      return;
    }
    setErr(null);
    setSaving(true);
    const res = isEdit
      ? await fetch(`/api/tasks/${editor.task.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: t, description: description.trim() }),
        })
      : await fetch(`/api/tasks`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId,
            title: t,
            description: description.trim(),
            status: editor.status,
          }),
        });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "Не удалось сохранить");
      return;
    }
    onSaved(data.task as BoardTask, !isEdit);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-base font-semibold text-slate-800 dark:text-slate-100">
          {isEdit ? "Редактировать задачу" : "Новая задача"}
          {!isEdit && (
            <span className="ml-2 text-xs font-normal text-slate-400">
              → {TASK_STATUS_LABEL[editor.status]}
            </span>
          )}
        </h3>

        <label className="block text-xs font-medium text-slate-500">Название</label>
        <input
          value={title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Что нужно сделать?"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800"
        />

        <label className="mt-3 block text-xs font-medium text-slate-500">
          Описание
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={4}
          placeholder="Детали (необязательно)"
          className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800"
        />

        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-light disabled:opacity-60"
          >
            {saving ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
