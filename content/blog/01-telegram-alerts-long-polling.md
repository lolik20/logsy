---
title: "Telegram-бот для алертов без webhook: long polling через прокси в Next.js"
direction: "Технический разбор"
channel: "Habr, Telegram-каналы по веб-разработке"
audience: "Разработчики, веб-студии"
cta: "Бесплатный тариф Logsy — мониторинг сайтов с алертами в Telegram"
---

# Telegram-бот для алертов без webhook: long polling через прокси в Next.js

Когда сервис падает, узнать об этом хочется первым — не от клиента. Email доходит,
но его можно проспать. Telegram — там, где разработчик и так сидит весь день.
Проблема одна: «правильный» способ принимать апдейты от Telegram — это webhook,
а webhook требует публичного HTTPS-адреса, открытого наружу. Для внутренней
панели мониторинга это лишняя точка отказа и лишняя поверхность атаки.

В Logsy мы пошли другим путём — **long polling**. Бот сам опрашивает Telegram,
ничего наружу открывать не нужно, а если `api.telegram.org` недоступен напрямую
— запросы идут через прокси. Разберём реализацию.

## Почему long polling, а не webhook

Webhook хорош для публичных высоконагруженных ботов: Telegram сам стучится к вам,
когда есть апдейт. Но за это платите инфраструктурой:

- нужен публичный домен с валидным TLS-сертификатом;
- нужно держать открытый эндпоинт, который принимает POST от Telegram;
- на serverless (Vercel и т.п.) вебхук-обработчик живёт только на время запроса.

Для бота, который всего лишь рассылает алерты и по команде `/start` отдаёт
пользователю его `chat id`, это оверинжиниринг. Long polling переворачивает
модель: **наш** долгоживущий процесс раз в N секунд спрашивает у Telegram «есть
что-нибудь новое?». Ни входящих соединений, ни публичного эндпоинта.

Единственное жёсткое правило: `getUpdates` в рамках одного бота должен вызывать
**только один процесс**. Иначе Telegram вернёт `409 Conflict`.

## Запросы к Bot API через прокси

Глобальный `fetch` в Node.js реализован поверх [undici](https://github.com/nodejs/undici),
а undici умеет ходить через прокси с помощью `ProxyAgent`. Создаём диспетчер один
раз и переиспользуем:

```ts
import { ProxyAgent, type Dispatcher } from "undici";

const API_BASE = "https://api.telegram.org";

let dispatcher: ProxyAgent | undefined;
let dispatcherReady = false;

function getDispatcher(): Dispatcher | undefined {
  if (!dispatcherReady) {
    dispatcherReady = true;
    const url = process.env.TELEGRAM_PROXY_URL; // напр. http://user:pass@host:3128
    if (url) dispatcher = new ProxyAgent(url);
  }
  return dispatcher;
}
```

Сам вызов метода Bot API — обычный `fetch`, которому передаём `dispatcher`.
Важная деталь: у DOM-типа `RequestInit` нет поля `dispatcher` (это расширение
undici), поэтому приходится расширить тип локально. И ещё — таймаут запроса через
`AbortController` должен быть **больше**, чем long-poll timeout, иначе мы будем
рвать соединение раньше, чем Telegram успеет ответить:

```ts
async function telegramApi<T>(
  method: string,
  params: Record<string, unknown> = {},
  timeoutMs = 15000,
): Promise<T | null> {
  const token = getBotToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
      dispatcher: getDispatcher(),
    } as RequestInit & { dispatcher?: Dispatcher });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return data.result ?? null;
  } finally {
    clearTimeout(timer);
  }
}
```

## Цикл опроса

Сердце бота — бесконечный цикл `getUpdates`. Ключевое понятие — `offset`: это
`update_id` последнего обработанного апдейта плюс один. Передавая его в следующий
запрос, мы **подтверждаем** обработку предыдущих — Telegram больше не пришлёт их
снова. Стартуем с `offset = 0`: Telegram отдаст накопившийся backlog, и мы его
сразу подтвердим.

```ts
let polling = false;

export function startTelegramPolling(): void {
  if (polling) return;               // идемпотентно — второй вызов игнорируем
  if (!getBotToken()) return;
  polling = true;
  void pollLoop();
}

async function pollLoop(): Promise<void> {
  let offset = 0;
  const LONG_POLL_S = 30;

  while (polling) {
    try {
      const updates = await telegramApi<TgUpdate[]>(
        "getUpdates",
        { offset, timeout: LONG_POLL_S, allowed_updates: ["message"] },
        (LONG_POLL_S + 10) * 1000, // таймаут fetch > long-poll timeout
      );
      if (!updates) {
        await sleep(5000);          // ошибка/таймаут/прокси — пауза и повтор
        continue;
      }
      for (const u of updates) {
        offset = u.update_id + 1;   // подтверждаем апдейт
        await handleUpdate(u).catch((e) => console.error(e));
      }
    } catch (err) {
      await sleep(5000);
    }
  }
}
```

Обратите внимание на `timeout: 30` внутри `getUpdates` — это и есть long polling:
Telegram держит соединение до 30 секунд и отвечает сразу, как только появится
апдейт. Пустой опрос раз в 30 секунд почти ничего не стоит, а реакция на команду
пользователя — мгновенная.

## Что делает бот: отдаёт chat id

Чтобы слать человеку алерты, нам нужен его `chat id`. У Telegram нет способа
«найти пользователя по нику» — инициатором должен быть сам пользователь. Поэтому
флоу такой: пользователь жмёт в панели «Открыть бота» → нажимает `/start` → бот
отвечает его `chat id`, который пользователь копирует обратно в панель.

```ts
async function handleUpdate(update: TgUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const chat = message?.chat;
  if (!chat?.id) return;

  const text =
    `Это бот алертов <b>Logsy</b>.\n\n` +
    `Ваш chat id:\n<b><code>${chat.id}</code></b>\n\n` +
    `Вставьте его в панели на вкладке «Алерты», чтобы получать уведомления.`;

  await sendTelegramMessage(String(chat.id), text, { html: true });
}
```

## Грабли с parse_mode

Одна неочевидная деталь, на которой легко обжечься. Алерты мониторинга включают
кусок ответа проверяемого сайта — а это часто HTML (`<!doctype html>…`). Если
отправить такой текст с `parse_mode=HTML`, Telegram отвергнет сообщение с ошибкой
`400 Bad Request`, потому что решит, что это невалидная разметка.

Поэтому по умолчанию алерты уходят **без** `parse_mode` — как обычный текст.
HTML-режим включается только для наших собственных сообщений (как ответ с
`chat id` выше), и всё динамическое в них обязательно прогоняется через
`escapeHtml`:

```ts
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

## Где всё это живёт

Бот поднимается вместе с сервером через
[instrumentation hook](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
Next.js — функцию `register()`, которая выполняется один раз при старте:

```ts
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return; // не в edge-рантайме

  const { startScheduler } = await import("@/lib/scheduler");
  const { startTelegramPolling } = await import("@/lib/telegram");
  startScheduler();          // node-cron: проверки мониторов
  startTelegramPolling();    // long polling Telegram
}
```

Импорт динамический и под проверкой `NEXT_RUNTIME`, потому что `register()`
вызывается и в edge-, и в nodejs-рантайме, а Prisma и наш поллер работают только
в Node.js.

> **Важно про serverless.** Instrumentation-хук поднимает поллер в долгоживущем
> процессе (`next start` на своём VPS). На Vercel и подобных фоновые задачи не
> живут между запросами — там long polling работать не будет, и Telegram-бота
> нужно переключать на webhook либо выносить поллер в отдельный worker-процесс.

## Итог

Long polling — недооценённый способ сделать Telegram-бота для внутренних задач:
никаких публичных эндпоинтов, работает за прокси, разворачивается одним вызовом
при старте сервера. Для бота алертов, который живёт внутри вашего же приложения,
это ровно то, что нужно.

---

*Так устроены Telegram-алерты в [Logsy](https://logsy.ru) — сервисе мониторинга
доступности сайтов и логирования фронт-ошибок. **Для небольшого проекта всё
бесплатно и без ограничения по времени** (до 300 сессий в сутки): добавьте сайт,
укажите chat id — и падения будут прилетать в Telegram.*
