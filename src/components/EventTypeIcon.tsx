import type { ReactNode } from "react";

// Человекочитаемые названия типов событий — используются как всплывающая подсказка
// (title/aria-label) к иконке, чтобы в таблице сессии текст заменялся иконкой.
export const EVENT_TYPE_LABEL: Record<string, string> = {
  ERROR: "JS-ошибка",
  UNHANDLED_REJECTION: "Promise reject",
  HTTP_ERROR: "Ошибка запроса",
  SLOW_REQUEST: "Медленный запрос",
  SESSION_START: "Начало сессии",
  SESSION_END: "Выход с сайта",
  NAVIGATION: "Переход",
  CLICK: "Клик",
  INPUT: "Ввод",
  USER_REPORT: "Сообщение пользователя",
  PAGE_LOAD: "Загрузка страницы",
  SLOW_RESOURCE: "Медленный ресурс",
};

// Цвет иконки по типу события (тон совпадает с прежней подсветкой текста).
const TYPE_TONE: Record<string, string> = {
  ERROR: "text-red-600",
  UNHANDLED_REJECTION: "text-red-600",
  HTTP_ERROR: "text-orange-600",
  SLOW_REQUEST: "text-amber-600",
  SESSION_START: "text-emerald-600",
  SESSION_END: "text-slate-500",
  NAVIGATION: "text-blue-600",
  CLICK: "text-slate-500 dark:text-slate-300",
  INPUT: "text-slate-500 dark:text-slate-300",
  USER_REPORT: "text-violet-600",
  PAGE_LOAD: "text-sky-600",
  SLOW_RESOURCE: "text-amber-600",
};

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {children}
    </svg>
  );
}

// Иконка на каждый тип действия/события в сессии.
const ICONS: Record<string, ReactNode> = {
  // Треугольник с восклицанием — JS-ошибка.
  ERROR: (
    <Svg>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  ),
  // Восьмиугольник — необработанный reject.
  UNHANDLED_REJECTION: (
    <Svg>
      <path d="M7.9 2.7h8.2L21.3 8v8.2l-5.2 5.1H7.9L2.7 16V7.9Z" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Svg>
  ),
  // Молния в круге — ошибка сетевого запроса.
  HTTP_ERROR: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M13 7l-4 6h3l-1 4 4-6h-3z" />
    </Svg>
  ),
  // Часы — медленный запрос.
  SLOW_REQUEST: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  ),
  // Вход (стрелка внутрь) — начало сессии.
  SESSION_START: (
    <Svg>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </Svg>
  ),
  // Выход (стрелка наружу) — выход с сайта / отказ.
  SESSION_END: (
    <Svg>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </Svg>
  ),
  // Компас/стрелка — переход по страницам.
  NAVIGATION: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="M16.2 7.8l-2.9 6.5-6.5 2.9 2.9-6.5z" />
    </Svg>
  ),
  // Указатель мыши — клик.
  CLICK: (
    <Svg>
      <path d="M4 4l7 16 2.5-6.5L20 11z" />
    </Svg>
  ),
  // Поле ввода — ввод.
  INPUT: (
    <Svg>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10v4" />
    </Svg>
  ),
  // Речевой пузырь — сообщение пользователя (обратная форма ошибок).
  USER_REPORT: (
    <Svg>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  ),
  // Секундомер — время загрузки страницы.
  PAGE_LOAD: (
    <Svg>
      <path d="M12 2h0" />
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M9 2h6" />
    </Svg>
  ),
  // Документ со стрелкой вниз — медленно загружаемый статический файл.
  SLOW_RESOURCE: (
    <Svg>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
      <path d="M12 12v5" />
      <path d="m9.5 15 2.5 2.5 2.5-2.5" />
    </Svg>
  ),
};

// Иконка типа события с подсказкой-названием (вместо текстовой метки в таблице сессии).
export function EventTypeIcon({ type }: { type: string }) {
  const label = EVENT_TYPE_LABEL[type] ?? type;
  const tone = TYPE_TONE[type] ?? "text-slate-500";
  return (
    <span
      className={`inline-flex items-center justify-center ${tone}`}
      title={label}
      aria-label={label}
    >
      {ICONS[type] ?? (
        <Svg>
          <circle cx="12" cy="12" r="9" />
        </Svg>
      )}
    </span>
  );
}
