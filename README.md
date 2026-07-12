# Logsy — сервис мониторинга uptime

Мониторинг доступности сайтов и API для российского рынка. Пользователь
регистрируется, добавляет проекты (домены) и мониторы (URL + HTTP-метод +
периодичность), а фоновый воркер каждую минуту проверяет эндпоинты и шлёт
email-алерты при падении.

## Возможности

- **Лендинг** с описанием и тарифом (300 ₽ за 1 сайт в месяц).
- **Авторизация** через Яндекс ID или по почте (пароль генерируется на бэкенде
  и отправляется письмом).
- **Проекты** → **мониторы**: URL для проверки, метод `GET/POST/PUT/DELETE`,
  периодичность `1m / 1h / 1d`, ожидаемый код ответа.
- **Планировщик** (node-cron) обходит БД каждую минуту и проверяет мониторы,
  которым подошёл срок.
- **Алерты на почту** при переходе монитора в статус DOWN (и при
  восстановлении). Контакты настраиваются в панели.
- **История проверок** и uptime по каждому монитору.

## Стек

Next.js 14 (App Router) · React · TypeScript · Prisma (PostgreSQL) ·
Auth.js (NextAuth v5) · nodemailer · node-cron · Tailwind CSS · zod.

## Быстрый старт

```bash
cp .env.example .env      # укажите DATABASE_URL к вашему PostgreSQL
npm install
npm run db:push           # создаст таблицы в PostgreSQL
npm run dev               # http://localhost:3000
```

`DATABASE_URL` имеет вид
`postgresql://user:password@host:5432/logsy?schema=public`.

Регистрация: на `/register` укажите email. Без настроенного SMTP пароль будет
**выведен в консоль сервера** (dev-режим) — скопируйте его и войдите на `/login`.

### Запуск проверок

Проверки запускаются **автоматически внутри сервера Next.js** через хук
инструментации (`src/instrumentation.ts`). Как только сервер поднят
(`npm run dev` или `npm run build && npm start`), планировщик (node-cron)
каждую минуту обходит активные мониторы, у которых подошёл срок по их интервалу
(`1m/1h/1d`), пишет результаты и отправляет алерты. Отдельную команду запускать
не нужно.

> Важно: инструментация работает в долгоживущем Node-процессе (`next start` на
> своём сервере/VPS). На serverless-хостинге (напр. Vercel) фоновые задачи не
> живут между запросами — там используйте внешний cron на эндпоинт ниже.

Дополнительные способы (не обязательны):

```bash
# отдельный процесс-воркер (альтернатива инструментации)
npm run worker

# внешний cron дёргает эндпоинт
curl -X POST "http://localhost:3000/api/cron/run?token=$CRON_SECRET"
```

## Переменные окружения

См. `.env.example`. Ключевые:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `AUTH_SECRET` | Секрет Auth.js (`openssl rand -base64 32`) |
| `AUTH_YANDEX_ID` / `AUTH_YANDEX_SECRET` | Yandex ID OAuth (иначе кнопка скрыта) |

### Yandex ID OAuth

1. Создайте приложение на <https://oauth.yandex.ru/>.
2. В поле **Redirect URI** (Callback URL) укажите:

   ```
   ${NEXTAUTH_URL}/api/auth/callback/yandex
   ```

   Локально это `http://localhost:3000/api/auth/callback/yandex`,
   в проде — `https://ваш-домен/api/auth/callback/yandex`.
3. Выдайте права (scope, провайдер запрашивает по умолчанию
   `login:info login:email login:avatar`):
   - «Доступ к адресу электронной почты» (`login:email`) — обязательно, email это ключ пользователя;
   - «Доступ к логину, имени и фамилии» (`login:info`);
   - «Доступ к портрету пользователя» (`login:avatar`).
4. Скопируйте `ID` и `Client secret` приложения в `AUTH_YANDEX_ID` и `AUTH_YANDEX_SECRET`.

Колбэк-эндпоинт обрабатывается автоматически catch-all роутом
`src/app/api/auth/[...nextauth]/route.ts` — отдельный обработчик не нужен.
| `SMTP_*` | SMTP для писем (иначе письма пишутся в консоль) |
| `CRON_SECRET` | Токен для `POST /api/cron/run` |

## Переход на PostgreSQL

В `prisma/schema.prisma` смените `provider = "sqlite"` на `"postgresql"`,
укажите `DATABASE_URL`, затем `npm run db:push`.

## Заметки

- Биллинг (300 ₽/сайт) реализован как заглушка: активация подписки увеличивает
  лимит сайтов. Реальную YooKassa можно подключить в
  `src/app/api/billing/subscribe/route.ts`.
