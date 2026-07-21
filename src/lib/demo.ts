// Демонстрационный («demo») сайт для пользователей, которые ещё не подключили ни одного
// проекта. Цель — показать весь внутренний функционал панели ровно так, как он выглядит на
// реальном подключённом сайте: мониторинг доступности, SSL/домен, пользовательские сессии с
// записью экрана, ошибки, медленные запросы, обратная форма, задачи и т. д. Все данные здесь
// синтетические и живут только в памяти — в БД ничего не пишется и не читается. Каждый блок в
// demo-страницах сопровождается пояснением (см. FEATURES ниже и компонент DemoNote), поэтому
// новый пользователь понимает назначение каждой функции ещё до подключения своего сайта.

export const DEMO_PROJECT_ID = "demo";
// Идентификатор тестовой сессии. Совпадает со значением, которое SessionReplay запрашивает у
// /api/recordings/[sessionId]; для него эндпоинт отдаёт синтетическую запись (см. route.ts).
export const DEMO_SESSION_ID = "demo";

export const demoProject = {
  id: DEMO_PROJECT_ID,
  name: "Demo Shop",
  domain: "demo-shop.ru",
  recordSession: true,
  slowMs: 1000,
  sessionsPerDay: 300,
  retentionHours: 12,
  // SSL и домен — «здоровые» значения для наглядности.
  sslStatus: "VALID" as const,
  sslDaysLeft: 74,
  sslIssuer: "Let's Encrypt",
  domainStatus: "VALID" as const,
  domainDaysLeft: 213,
  domainRegistrar: "REG.RU",
};

export type DemoMonitor = {
  id: string;
  name: string;
  method: string;
  url: string;
  interval: "1m" | "1h" | "1d";
  status: "UP" | "DOWN" | "PENDING";
  responseMs: number | null;
  error: string | null;
};

// Мониторы демо-сайта: главная и API работают, оплата «упала» — чтобы показать статус DOWN и
// текст ошибки от сервера так же, как на реальном сайте.
export const demoMonitors: DemoMonitor[] = [
  {
    id: "demo-m1",
    name: "Главная страница",
    method: "GET",
    url: "https://demo-shop.ru/",
    interval: "1m",
    status: "UP",
    responseMs: 182,
    error: null,
  },
  {
    id: "demo-m2",
    name: "Каталог товаров",
    method: "GET",
    url: "https://demo-shop.ru/catalog",
    interval: "1m",
    status: "UP",
    responseMs: 240,
    error: null,
  },
  {
    id: "demo-m3",
    name: "Оплата заказа",
    method: "POST",
    url: "https://demo-shop.ru/api/checkout",
    interval: "1m",
    status: "DOWN",
    responseMs: null,
    error: "HTTP 500 Internal Server Error (ожидался 200)",
  },
];

// Тип демонстрационного события пользовательской сессии (совместим по полям с LogEvent —
// используется теми же презентационными блоками, что и реальные логи).
export type DemoEvent = {
  id: string;
  type:
    | "SESSION_START"
    | "PAGE_LOAD"
    | "NAVIGATION"
    | "SLOW_REQUEST"
    | "ERROR"
    | "HTTP_ERROR"
    | "UNHANDLED_REJECTION"
    | "USER_REPORT"
    | "SESSION_END";
  message: string | null;
  url: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  durationMs: number | null;
  stack: string | null;
  reqBody: string | null;
  resBody: string | null;
  offsetMs: number; // смещение от начала сессии, мс — для расчёта времени события
};

// Лента тестовой сессии: заход на сайт, медленный запрос каталога, JS-ошибка, упавшая оплата
// (HTTP 500), необработанный reject, сообщение пользователя из обратной формы и уход с сайта.
const demoEventDefs: DemoEvent[] = [
  {
    id: "demo-e1",
    type: "SESSION_START",
    message: "Заход на сайт (реклама, utm_source=yandex)",
    url: "https://demo-shop.ru/?utm_source=yandex&utm_campaign=sale",
    route: null,
    method: null,
    statusCode: null,
    durationMs: null,
    stack: null,
    reqBody: null,
    resBody: null,
    offsetMs: 0,
  },
  {
    id: "demo-e2",
    type: "PAGE_LOAD",
    message: "Главная страница загружена",
    url: "https://demo-shop.ru/",
    route: null,
    method: null,
    statusCode: null,
    durationMs: 640,
    stack: null,
    reqBody: null,
    resBody: null,
    offsetMs: 900,
  },
  {
    id: "demo-e3",
    type: "SLOW_REQUEST",
    message: "Медленный ответ каталога",
    url: "https://demo-shop.ru/catalog",
    route: "https://demo-shop.ru/api/catalog?category=shoes",
    method: "GET",
    statusCode: 200,
    durationMs: 2380,
    stack: null,
    reqBody: null,
    resBody: null,
    offsetMs: 4200,
  },
  {
    id: "demo-e4",
    type: "ERROR",
    message: "TypeError: Cannot read properties of undefined (reading 'price')",
    url: "https://demo-shop.ru/catalog",
    route: null,
    method: null,
    statusCode: null,
    durationMs: null,
    stack:
      "TypeError: Cannot read properties of undefined (reading 'price')\n" +
      "    at renderCard (catalog.js:142:18)\n" +
      "    at Array.map (<anonymous>)\n" +
      "    at renderCatalog (catalog.js:120:34)",
    reqBody: null,
    resBody: null,
    offsetMs: 5200,
  },
  {
    id: "demo-e5",
    type: "HTTP_ERROR",
    message: "Ошибка оплаты заказа",
    url: "https://demo-shop.ru/checkout",
    route: "https://demo-shop.ru/api/checkout",
    method: "POST",
    statusCode: 500,
    durationMs: 1240,
    stack: null,
    reqBody: '{"cart":[{"sku":"RUN-42","qty":1}],"promo":"SALE20"}',
    resBody: '{"error":"payment_provider_timeout","requestId":"req_8f2a"}',
    offsetMs: 6500,
  },
  {
    id: "demo-e6",
    type: "UNHANDLED_REJECTION",
    message: "Uncaught (in promise): payment_provider_timeout",
    url: "https://demo-shop.ru/checkout",
    route: null,
    method: null,
    statusCode: null,
    durationMs: null,
    stack:
      "UnhandledRejection: payment_provider_timeout\n" +
      "    at checkout.js:88:12",
    reqBody: null,
    resBody: null,
    offsetMs: 6700,
  },
  {
    id: "demo-e7",
    type: "USER_REPORT",
    message: "Не могу оплатить заказ — после нажатия «Оплатить» ошибка. Помогите!",
    url: "https://demo-shop.ru/checkout",
    route: null,
    method: null,
    statusCode: null,
    durationMs: null,
    stack: null,
    reqBody: null,
    resBody: null,
    offsetMs: 8200,
  },
  {
    id: "demo-e8",
    type: "SESSION_END",
    message: "Пользователь ушёл со страницы оплаты (отказ)",
    url: "https://demo-shop.ru/checkout",
    route: null,
    method: null,
    statusCode: null,
    durationMs: null,
    stack: null,
    reqBody: null,
    resBody: null,
    offsetMs: 9600,
  },
];

// Метаданные тестовой сессии: IP, страна, устройство и время начала (условно — «сегодня»).
export const demoSession = {
  id: DEMO_SESSION_ID,
  sessionKey: "demo42",
  ip: "203.0.113.42",
  country: "RU",
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 " +
    "(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  utm: '{"utm_source":"yandex","utm_campaign":"sale"}',
};

/** Демо-события с проставленным абсолютным временем от заданного начала сессии. */
export function demoEvents(startedAt: Date): (DemoEvent & { createdAt: Date })[] {
  const base = startedAt.getTime();
  return demoEventDefs.map((e) => ({ ...e, createdAt: new Date(base + e.offsetMs) }));
}

/** Время старта тестовой сессии — недавнее «сегодня», чтобы попадать в фильтр по дате. */
export function demoSessionStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - 11 * 60 * 1000); // 11 минут назад
}

// -------------------- Синтетическая запись экрана (rrweb) --------------------
// Плеер SessionReplay строит воспроизведение из потока событий rrweb. Здесь мы вручную
// собираем минимальную, но валидную запись «страницы оплаты» demo-магазина: полный DOM-снимок
// (type 2), движение курсора к кнопке «Оплатить» (source 1), клик (source 2) и мутацию —
// появление красного баннера «Оплата не прошла» (source 0). Метки ошибок/медленных запросов на
// дорожке времени плеера отдаёт /api/recordings/demo.

type SNode =
  | { type: 0; id: number; childNodes: SNode[] }
  | { type: 1; id: number; name: string; publicId: string; systemId: string }
  | {
      type: 2;
      id: number;
      tagName: string;
      attributes: Record<string, string>;
      childNodes: SNode[];
    }
  | { type: 3; id: number; textContent: string };

// Аллокатор id узлов: у каждого сериализованного узла rrweb должен быть уникальный id.
let nid = 0;
const nextId = () => ++nid;

function el(
  tagName: string,
  attributes: Record<string, string>,
  childNodes: SNode[] = [],
): SNode {
  return { type: 2, id: nextId(), tagName, attributes, childNodes };
}
function txt(textContent: string): SNode {
  return { type: 3, id: nextId(), textContent };
}

const DEMO_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; background: #f1f5f9; color: #0f172a; }
.wrap { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
.brand { font-size: 20px; font-weight: 700; margin-bottom: 16px; }
.card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; }
.card h1 { font-size: 18px; margin-bottom: 16px; }
.row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-top: 1px solid #f1f5f9; }
.row .name { font-weight: 600; }
.row .price { font-weight: 700; }
.total { display: flex; justify-content: space-between; padding: 14px 0 4px; font-size: 17px; font-weight: 700; }
.buy { display: block; width: 100%; margin-top: 16px; padding: 14px; border: 0; border-radius: 12px; background: #4f46e5; color: #fff; font-size: 16px; font-weight: 600; cursor: pointer; }
.err { margin-top: 16px; padding: 12px 14px; border-radius: 12px; background: #fee2e2; color: #b91c1c; font-weight: 600; }
`;

/** Строит полный DOM-снимок demo-страницы и возвращает узел + id ключевых элементов. */
function buildSnapshot(): {
  node: SNode;
  bodyId: number;
  buyId: number;
  statusHostId: number;
} {
  nid = 0; // детерминированные id для каждой сборки записи
  const buy = el("button", { class: "buy" }, [txt("Оплатить 6 990 ₽")]);
  // Пустой контейнер под статус оплаты — в него мутацией добавим баннер ошибки.
  const statusHost = el("div", { id: "status" }, []);
  const card = el("div", { class: "card" }, [
    el("h1", {}, [txt("Оформление заказа")]),
    el("div", { class: "row" }, [
      el("span", { class: "name" }, [txt("Кроссовки Runner 42")]),
      el("span", { class: "price" }, [txt("6 990 ₽")]),
    ]),
    el("div", { class: "row" }, [
      el("span", { class: "name" }, [txt("Доставка")]),
      el("span", { class: "price" }, [txt("бесплатно")]),
    ]),
    el("div", { class: "total" }, [txt("Итого"), txt("6 990 ₽")]),
    buy,
    statusHost,
  ]);
  const body = el("body", {}, [
    el("div", { class: "wrap" }, [
      el("div", { class: "brand" }, [txt("🛍 Demo Shop")]),
      card,
    ]),
  ]);
  const head = el("head", {}, [el("style", { type: "text/css" }, [txt(DEMO_CSS)])]);
  const html = el("html", { lang: "ru" }, [head, body]);
  const docType: SNode = {
    type: 1,
    id: nextId(),
    name: "html",
    publicId: "",
    systemId: "",
  };
  const doc: SNode = { type: 0, id: nextId(), childNodes: [docType, html] };
  return {
    node: doc,
    bodyId: body.id,
    buyId: buy.id,
    statusHostId: statusHost.id,
  };
}

type RRWebEvent = { type: number; timestamp: number; data: unknown };

/**
 * Собирает синтетическую запись экрана тестовой сессии и метки её ошибок/медленных запросов.
 * base — момент начала записи (epoch ms). Метки выставляются в те же часы, что и события rrweb.
 */
export function buildDemoRecording(base: number): {
  events: RRWebEvent[];
  markers: Array<{
    t: number;
    kind: "error" | "slow";
    label: string;
    type: string;
    message: string | null;
    method: string | null;
    route: string | null;
    statusCode: number | null;
    durationMs: number | null;
    url: string | null;
  }>;
} {
  const snap = buildSnapshot();
  const width = 390;
  const height = 780;

  const events: RRWebEvent[] = [];

  // Meta — адрес и размеры вьюпорта записи.
  events.push({
    type: 4,
    timestamp: base,
    data: { href: "https://demo-shop.ru/checkout", width, height },
  });
  // FullSnapshot — полный DOM-снимок страницы.
  events.push({
    type: 2,
    timestamp: base,
    data: { node: snap.node, initialOffset: { left: 0, top: 0 } },
  });

  // Движение курсора к кнопке «Оплатить» (source 1 — MouseMove).
  const path: Array<[number, number, number]> = [
    [120, 160, 500],
    [170, 280, 1200],
    [200, 420, 2000],
    [195, 560, 2800],
    [195, 590, 3300],
  ];
  for (const [x, y, off] of path) {
    events.push({
      type: 3,
      timestamp: base + off,
      data: {
        source: 1,
        positions: [{ x, y, id: snap.buyId, timeOffset: 0 }],
      },
    });
  }

  // Клик по кнопке «Оплатить» (source 2 — MouseInteraction, type 2 — Click).
  events.push({
    type: 3,
    timestamp: base + 3600,
    data: { source: 2, type: 2, id: snap.buyId, x: 195, y: 590 },
  });

  // Мутация: в контейнер #status добавляется красный баннер «Оплата не прошла» (source 0).
  // rrweb в мутациях не разворачивает вложенные childNodes сам — каждый узел (элемент и его
  // текст) добавляем отдельной записью adds: сначала <div>, затем текстовый узел внутрь него.
  const banner = el("div", { class: "err" }, []);
  const bannerText = txt("⛔ Оплата не прошла. Попробуйте позже.");
  events.push({
    type: 3,
    timestamp: base + 6500,
    data: {
      source: 0,
      texts: [],
      attributes: [],
      removes: [],
      adds: [
        { parentId: snap.statusHostId, nextId: null, node: banner },
        { parentId: banner.id, nextId: null, node: bannerText },
      ],
    },
  });

  // Небольшое финальное движение курсора — чтобы запись длилась ~9.6 с (уход со страницы).
  events.push({
    type: 3,
    timestamp: base + 9600,
    data: { source: 1, positions: [{ x: 40, y: 40, id: snap.bodyId, timeOffset: 0 }] },
  });

  const markers = [
    {
      t: base + 4200,
      kind: "slow" as const,
      label: "GET /api/catalog · 2380 мс",
      type: "SLOW_REQUEST",
      message: "Медленный ответ каталога",
      method: "GET",
      route: "https://demo-shop.ru/api/catalog?category=shoes",
      statusCode: 200,
      durationMs: 2380,
      url: "https://demo-shop.ru/catalog",
    },
    {
      t: base + 6500,
      kind: "error" as const,
      label: "POST /api/checkout → 500",
      type: "HTTP_ERROR",
      message: "Ошибка оплаты заказа",
      method: "POST",
      route: "https://demo-shop.ru/api/checkout",
      statusCode: 500,
      durationMs: 1240,
      url: "https://demo-shop.ru/checkout",
    },
  ];

  return { events, markers };
}

// -------------------- Пояснения к каждой функции панели --------------------
// Короткие описания назначения каждого сервиса — выводятся рядом с блоками demo-страниц, чтобы
// новый пользователь понимал, что делает каждая функция, ещё до подключения своего сайта.
export type DemoFeature = { title: string; text: string };

export const FEATURES: Record<string, DemoFeature> = {
  monitoring: {
    title: "Мониторинг доступности",
    text: "Регулярно опрашиваем адреса сайта (GET/POST) с выбранной периодичностью и следим, отвечает ли сервер ожидаемым кодом. Если проверка падает — статус меняется на «Недоступен», а в контакты уходит оповещение.",
  },
  ssl: {
    title: "Контроль SSL-сертификата",
    text: "Следим за сроком действия HTTPS-сертификата домена и заранее предупреждаем (за неделю, 3 дня, сутки, час), чтобы сайт не «покраснел» из-за просроченного сертификата.",
  },
  domain: {
    title: "Контроль срока домена",
    text: "По данным регистратора (RDAP/WHOIS) отслеживаем дату окончания регистрации домена и напоминаем продлить его заранее, чтобы сайт не отключился.",
  },
  sessions: {
    title: "Сессии пользователей",
    text: "SDK на сайте собирает действия посетителей, ошибки и сетевые запросы и группирует их в сессии по IP и стране. Так видно, что именно делал пользователь и с чем столкнулся.",
  },
  replay: {
    title: "Запись экрана сессии",
    text: "Действия посетителя записываются (rrweb) и воспроизводятся как видео. На дорожке времени отмечены ошибки (красным) и медленные запросы (жёлтым) — можно перемотать прямо к проблеме. Пароли и отмеченные поля маскируются на клиенте.",
  },
  errors: {
    title: "Ошибки",
    text: "Ловим JS-ошибки, необработанные reject и ошибки сетевых запросов (например HTTP 500). Одинаковые ошибки сворачиваются в «Топ ошибок», а о новых можно получать уведомления не чаще раза в час.",
  },
  slow: {
    title: "Медленные запросы",
    text: "Запросы и статические файлы дольше заданного порога (по умолчанию 1000 мс) помечаются как медленные и попадают в «Топ медленных запросов» — видно, что тормозит сайт.",
  },
  feedback: {
    title: "Обратная форма ошибок",
    text: "На сайте показывается плавающая кнопка: посетитель может кратко сообщить о проблеме. Сообщение приходит в его сессию (событие «Сообщение пользователя») и автоматически заводит задачу.",
  },
  tasks: {
    title: "Задачи",
    text: "Канбан-доска (Создано → В работе → Выполнено). Задачи создаются вручную или автоматически из сообщений обратной формы; на обращение можно ответить пользователю письмом прямо из карточки.",
  },
  pages: {
    title: "Карта страниц",
    text: "Краулер обходит сайт по внутренним ссылкам и строит карту страниц. На ней видно среднее время загрузки и самые тяжёлые/медленные запросы каждой страницы.",
  },
  contacts: {
    title: "Контакты и алерты",
    text: "Каналы оповещений — email и Telegram. На них приходят уведомления о падении сайта, проблемах с SSL, доменом, тарифом и о новых ошибках в сессиях.",
  },
  tariff: {
    title: "Тариф",
    text: "Тарификация — за сайт. Бесплатно: 300 сессий в сутки и хранение логов 12 часов. Лимиты можно расширить помесячной доплатой (ползунки на вкладке «Тариф»).",
  },
};
