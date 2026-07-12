// Бейдж состояния SSL-сертификата монитора. daysLeft показывается для
// действующих и истекающих сертификатов, чтобы владелец видел запас времени.
export function SslBadge({
  status,
  daysLeft,
}: {
  status: string;
  daysLeft?: number | null;
}) {
  const map: Record<string, { label: string; cls: string }> = {
    VALID: {
      label: daysLeft != null ? `SSL: ${daysLeft} дн.` : "SSL: ок",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
    },
    EXPIRING: {
      label: daysLeft != null ? `SSL истекает: ${daysLeft} дн.` : "SSL истекает",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    },
    EXPIRED: {
      label: "SSL истёк",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    },
    ERROR: {
      label: "SSL: ошибка",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    },
    PENDING: {
      label: "SSL: ожидает",
      cls: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    },
  };
  // Для OFF (проверка отключена / не https) бейдж не показываем.
  if (status === "OFF") return null;
  const s = map[status] ?? map.PENDING;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      {s.label}
    </span>
  );
}
