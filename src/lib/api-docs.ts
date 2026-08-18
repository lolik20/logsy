// Описание публичного HTTP-API проекта в одном месте.
//
// Из этого файла собираются: публичные страницы документации (/docs/api и /docs/api/…),
// машинная спецификация OpenAPI (/api/v1/openapi.json) и карта для ИИ-агентов (/llms.txt).
// Так документация не расходится с реальностью в трёх местах сразу.
//
// Зачем публичные страницы. Раньше документация жила только внутри панели, за авторизацией —
// поисковики её не видели, а ИИ-агент не мог прочитать перед подключением. Теперь описание
// открыто, а закрытым остаётся только ключ проекта.

/** Базовый адрес сервиса без завершающего слэша. */
export function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://logsy.ru").replace(/\/$/, "");
}

/** Параметр запроса в описании метода. */
export interface ApiParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** Поле ответа — для таблицы «что вернётся». */
export interface ApiField {
  name: string;
  type: string;
  description: string;
}

export interface ApiEndpoint {
  /** Часть публичного адреса: /docs/api/<slug>. */
  slug: string;
  method: "GET";
  path: string;
  /** Заголовок страницы и пункта меню. */
  title: string;
  /** Одно предложение для списка и для description страницы. */
  summary: string;
  /** Развёрнутое описание: что метод отдаёт и когда он нужен. */
  description: string;
  params: ApiParam[];
  fields: ApiField[];
  curl: string;
  response: string;
  /** Типовые задачи, которые решает метод — для ИИ-агента и для SEO-текста. */
  useCases: string[];
}

const KEY = "$LOGSY_API_KEY";

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    slug: "sessions",
    method: "GET",
    path: "/api/v1/sessions",
    title: "Список сессий проекта",
    summary: "Пользовательские сессии сайта со счётчиками ошибок и медленных запросов.",
    description:
      "Возвращает сессии посетителей от самой свежей активности к старой: кто пришёл (IP, страна, User-Agent, метки перехода) и сколько в сессии событий, ошибок и медленных запросов. Ответ постраничный — по нему удобно искать сессии, в которых что-то сломалось, и уже потом запрашивать их детально.",
    params: [
      { name: "date", type: "YYYY-MM-DD", required: false, description: "Сессии, начавшиеся в указанные сутки (UTC). Короткая замена пары from/to: если передан, перекрывает их." },
      { name: "from", type: "ISO-8601", required: false, description: "Начало периода по времени старта сессии, включительно." },
      { name: "to", type: "ISO-8601", required: false, description: "Конец периода по времени старта сессии, не включая границу." },
      { name: "limit", type: "1…200", required: false, description: "Сколько сессий вернуть. По умолчанию 50." },
      { name: "offset", type: "≥ 0", required: false, description: "Сколько сессий пропустить — постраничный обход. По умолчанию 0." },
    ],
    fields: [
      { name: "total", type: "number", description: "Сколько сессий попало под фильтр целиком, без учёта limit." },
      { name: "sessions[].id", type: "string", description: "Идентификатор сессии — им запрашиваются события." },
      { name: "sessions[].startedAt", type: "ISO-8601", description: "Когда сессия началась." },
      { name: "sessions[].country", type: "string | null", description: "Страна посетителя по IP, ISO-3166 alpha-2." },
      { name: "sessions[].utm", type: "object | null", description: "Метки перехода: utm_source, utm_medium, yclid и прочие." },
      { name: "sessions[].events.errors", type: "number", description: "Сколько ошибок в сессии — по этому полю ищут сломанные визиты." },
      { name: "sessions[].events.slow", type: "number", description: "Сколько медленных запросов и ресурсов в сессии." },
    ],
    curl: `curl -H "Authorization: Bearer ${KEY}" \\\n  "$LOGSY_URL/api/v1/sessions?date=2026-08-18&limit=50"`,
    response: `{
  "project": { "id": "clx…", "name": "Мой сайт", "domain": "example.ru" },
  "total": 128,
  "limit": 50,
  "offset": 0,
  "sessions": [
    {
      "id": "clx8f2k0a0001qw",
      "sessionKey": "s-1755500000-9f3a",
      "startedAt": "2026-08-18T09:14:02.331Z",
      "lastSeenAt": "2026-08-18T09:21:47.902Z",
      "ip": "203.0.113.17",
      "country": "RU",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)…",
      "utm": { "utm_source": "yandex", "utm_medium": "cpc" },
      "events": { "total": 42, "errors": 3, "slow": 5 }
    }
  ]
}`,
    useCases: [
      "Найти сессии, в которых были ошибки, за вчерашний день",
      "Выгрузить визиты с конкретной рекламной кампании по метке utm_source",
      "Посчитать, сколько посетителей столкнулось с медленной загрузкой",
    ],
  },
  {
    slug: "session",
    method: "GET",
    path: "/api/v1/sessions/{id}",
    title: "Сессия со всеми событиями",
    summary: "Полная лента сессии: ошибки со стектрейсом, запросы с телом и заголовками, шаги пользователя.",
    description:
      "Возвращает одну сессию и все её события по порядку: переходы, клики, ввод, ошибки JavaScript со стектрейсом, упавшие и медленные сетевые запросы с кодом, временем и телом. Это и есть материал для разбора сбоя — по нему видно, что пользователь делал и что именно сломалось. Отдельно приходит признак наличия записи экрана.",
    params: [
      { name: "id", type: "string", required: true, description: "Идентификатор сессии из метода списка (часть пути, не query-параметр)." },
    ],
    fields: [
      { name: "session.recording.available", type: "boolean", description: "Есть ли запись экрана для этой сессии." },
      { name: "events[].type", type: "string", description: "Тип события: ERROR, HTTP_ERROR, SLOW_REQUEST, NAVIGATION, CLICK, INPUT, USER_REPORT и другие." },
      { name: "events[].message", type: "string | null", description: "Текст ошибки или подпись события." },
      { name: "events[].stack", type: "string | null", description: "Стектрейс JavaScript-ошибки." },
      { name: "events[].statusCode", type: "number | null", description: "HTTP-код ответа для сетевых событий." },
      { name: "events[].durationMs", type: "number | null", description: "Длительность запроса в миллисекундах." },
      { name: "events[].reqBody", type: "string | null", description: "Тело запроса (пароли замаскированы на клиенте)." },
      { name: "events[].resBody", type: "string | null", description: "Тело ответа для упавших запросов." },
    ],
    curl: `curl -H "Authorization: Bearer ${KEY}" \\\n  "$LOGSY_URL/api/v1/sessions/clx8f2k0a0001qw"`,
    response: `{
  "project": { "id": "clx…", "name": "Мой сайт", "domain": "example.ru" },
  "session": {
    "id": "clx8f2k0a0001qw",
    "startedAt": "2026-08-18T09:14:02.331Z",
    "country": "RU",
    "events": { "total": 42, "errors": 3, "slow": 5 },
    "recording": { "available": true, "chunks": 12 }
  },
  "events": [
    { "id": "e1", "type": "NAVIGATION", "url": "https://example.ru/checkout", "createdAt": "2026-08-18T09:14:03.100Z" },
    {
      "id": "e2",
      "type": "HTTP_ERROR",
      "method": "POST",
      "url": "https://example.ru/api/pay",
      "statusCode": 502,
      "durationMs": 8421,
      "reqBody": "{\\"orderId\\":\\"A-1024\\"}",
      "resBody": "<html>502 Bad Gateway</html>",
      "createdAt": "2026-08-18T09:14:12.884Z"
    },
    {
      "id": "e3",
      "type": "ERROR",
      "message": "Uncaught TypeError: Cannot read properties of undefined (reading 'id')",
      "stack": "at pay (checkout.js:118:24)…",
      "createdAt": "2026-08-18T09:14:13.002Z"
    }
  ]
}`,
    useCases: [
      "Понять, что именно сломалось у конкретного пользователя, и передать это агенту",
      "Достать тело упавшего запроса, чтобы воспроизвести ошибку локально",
      "Собрать шаги воспроизведения бага из ленты действий",
    ],
  },
];

/** Метод по слагу страницы, либо undefined. */
export function endpointBySlug(slug: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((e) => e.slug === slug);
}

/** Пример команды с подставленным базовым адресом сервиса. */
export function withBase(snippet: string): string {
  return snippet.replace(/\$LOGSY_URL/g, appUrl());
}

/** OpenAPI-спецификация для агентов и генераторов клиентов. */
export function openApiSpec() {
  const base = appUrl();
  const sessionSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      sessionKey: { type: "string" },
      startedAt: { type: "string", format: "date-time" },
      lastSeenAt: { type: "string", format: "date-time" },
      ip: { type: "string", nullable: true },
      country: { type: "string", nullable: true },
      userAgent: { type: "string", nullable: true },
      utm: { type: "object", nullable: true, additionalProperties: { type: "string" } },
      events: {
        type: "object",
        properties: {
          total: { type: "integer" },
          errors: { type: "integer" },
          slow: { type: "integer" },
        },
      },
    },
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Logsy API",
      version: "1.0.0",
      description:
        "Публичное HTTP-API проекта Logsy: пользовательские сессии сайта и их события — ошибки JavaScript, упавшие и медленные запросы, действия посетителя. Авторизация ключом проекта.",
      contact: { url: `${base}/docs/api` },
    },
    servers: [{ url: base }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "Ключ проекта из панели Logsy" },
        apiKeyHeader: { type: "apiKey", in: "header", name: "X-Api-Key" },
      },
      schemas: { Session: sessionSchema },
    },
    security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
    paths: {
      "/api/v1/sessions": {
        get: {
          operationId: "listSessions",
          summary: API_ENDPOINTS[0].summary,
          description: API_ENDPOINTS[0].description,
          parameters: API_ENDPOINTS[0].params.map((p) => ({
            name: p.name,
            in: "query",
            required: p.required,
            description: p.description,
            schema: { type: p.name === "limit" || p.name === "offset" ? "integer" : "string" },
          })),
          responses: {
            200: {
              description: "Список сессий",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      limit: { type: "integer" },
                      offset: { type: "integer" },
                      sessions: { type: "array", items: { $ref: "#/components/schemas/Session" } },
                    },
                  },
                },
              },
            },
            401: { description: "Неверный или отсутствующий ключ API" },
          },
        },
      },
      "/api/v1/sessions/{id}": {
        get: {
          operationId: "getSession",
          summary: API_ENDPOINTS[1].summary,
          description: API_ENDPOINTS[1].description,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              description: "Идентификатор сессии",
              schema: { type: "string" },
            },
          ],
          responses: {
            200: { description: "Сессия и её события" },
            401: { description: "Неверный или отсутствующий ключ API" },
            404: { description: "Сессия не найдена" },
          },
        },
      },
    },
  };
}
