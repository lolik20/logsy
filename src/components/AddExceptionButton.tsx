import Link from "next/link";
import { defaultExceptionUrl, eventKind } from "@/lib/exceptions";

/**
 * Кнопка «В исключения» напротив события лога. Ведёт на отдельную страницу с формой
 * правила-исключения, куда через query-строку передаются заполненные из события
 * параметры — категория (медленный запрос / ошибка) и URL. На странице пользователь
 * может поправить их и сохранить: новые подходящие события перестают сохраняться во
 * всём проекте. Уже записанные события остаются. Снять правило можно в блоке
 * «Исключения» над списком сессий.
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
  const defaultKind = eventKind(eventType);
  // Кнопку показываем только для событий, которые вообще можно исключить.
  if (!defaultKind) return null;

  const params = new URLSearchParams({
    kind: defaultKind,
    url: defaultExceptionUrl({ route, url }),
  });
  const href = `/dashboard/projects/${projectId}/exceptions/new?${params.toString()}`;

  return (
    <Link
      href={href}
      title={
        excluded
          ? "Событие уже подходит под правило-исключение. Открыть, чтобы добавить ещё одно"
          : "Больше не сохранять такие события во всём проекте"
      }
      className={`inline-block whitespace-nowrap rounded-lg border px-2.5 py-1 text-xs font-medium ${
        excluded
          ? "border-slate-300 text-slate-500 hover:border-slate-400 dark:border-slate-700"
          : "border-slate-300 hover:border-amber-400 hover:text-amber-600 dark:border-slate-700"
      }`}
    >
      {excluded ? "В исключениях" : "В исключения"}
    </Link>
  );
}
