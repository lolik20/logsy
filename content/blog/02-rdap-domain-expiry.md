---
title: "RDAP вместо WHOIS: как следить за сроком регистрации домена из кода"
direction: "Технический разбор"
channel: "Habr"
audience: "Разработчики, DevOps, эксплуатация"
cta: "Logsy сам следит за сроком домена и SSL и предупреждает заранее"
---

# RDAP вместо WHOIS: как следить за сроком регистрации домена из кода

Забыть продлить домен — классика. Автоплатёж не прошёл, письмо регистратора
улетело в спам, ответственный уволился — и в один день сайт просто перестаёт
резолвиться. Лечится это одним: программной проверкой срока регистрации и
заблаговременными напоминаниями. Вопрос — как получить дату окончания
регистрации из кода надёжно.

Первое, что приходит в голову — WHOIS. И это худший вариант. Разберём, почему, и
как мы в Logsy делаем это через **RDAP**.

## Чем плох WHOIS

WHOIS — протокол 1980-х. Клиент открывает TCP-соединение на порт 43 и получает
назад **произвольный текст**, формат которого у каждого реестра свой:

```
Domain Name: EXAMPLE.RU
Registrar: RU-CENTER-RU
paid-till: 2026-03-15T21:00:00Z
```

против

```
Registry Expiry Date: 2026-03-15T21:00:00Z
```

Поле называется то `paid-till`, то `Registry Expiry Date`, то `Expiration Date`;
дата в десятке разных форматов; половина реестров отдаёт ответ с rate-limit и
капчей. Парсить это регэкспами — боль и постоянные поломки.

## RDAP — то же самое, но по-человечески

RDAP (Registration Data Access Protocol) — современная замена WHOIS,
стандартизованная в RFC 7482–7484. По сути это **HTTP + JSON**: делаете
`GET /domain/example.com` и получаете структурированный ответ.

Дата окончания регистрации лежит в массиве `events` — ищем событие с
`eventAction: "expiration"`:

```json
{
  "events": [
    { "eventAction": "registration", "eventDate": "2010-03-15T21:00:00Z" },
    { "eventAction": "expiration",   "eventDate": "2026-03-15T21:00:00Z" }
  ],
  "entities": [
    { "roles": ["registrar"], "vcardArray": ["vcard", [ ... ]] }
  ]
}
```

Никакого парсинга свободного текста — берём поле по имени.

## Один адрес на все реестры: rdap.org

У каждого TLD свой RDAP-сервер, и держать таблицу «TLD → сервер» не хочется.
Есть публичный редиректор [rdap.org](https://about.rdap.org/): запрашиваете
`https://rdap.org/domain/<домен>`, а он 302-редиректом отправляет вас на нужный
RDAP-сервер реестра. Нужно лишь следовать редиректам (`redirect: "follow"`).

```ts
export async function checkDomainRegistration(
  hostOrUrl: string,
  timeoutMs = 10000,
): Promise<DomainInfo> {
  const domain = registrableDomain(hostOrUrl);      // www.example.com → example.com
  if (!domain) return fail("Некорректный домен");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "application/rdap+json, application/json",
        "user-agent": "LogsyMonitor/1.0",
      },
    });
    if (res.status === 404) return fail("Домен не найден в реестре");
    if (!res.ok) return fail(`RDAP вернул статус ${res.status}`);

    const data = await res.json();
    const expEvent = data.events?.find((e) => e.eventAction === "expiration");
    if (!expEvent?.eventDate) return fail("Реестр не сообщил дату окончания");

    const expiresAt = new Date(expEvent.eventDate);
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / DAY_MS);
    return { ok: true, expiresAt, daysLeft, registrar: registrarName(data.entities), error: null };
  } finally {
    clearTimeout(timer);
  }
}
```

Пара практических деталей:

- **Приводим хост к регистрируемому домену.** RDAP отвечает на домен второго
  уровня, а не на `www.example.com` или `api.example.com`. Берём последние две
  метки хоста — этого достаточно для распространённых TLD (`.ru`, `.com`, `.net`,
  `.org`, `.io`):

  ```ts
  export function registrableDomain(hostOrUrl: string): string | null {
    let host = hostOrUrl.trim();
    if (host.includes("://")) host = new URL(host).hostname;
    host = host.replace(/^\/+/, "").replace(/\/.*$/, "").replace(/:.*/, "").toLowerCase();
    const labels = host.split(".").filter(Boolean);
    if (labels.length < 2) return null;
    return labels.slice(-2).join(".");
  }
  ```

  (Для сложных многосоставных суффиксов вроде `co.uk` нужен список Public Suffix
  List — но для основного набора TLD хватает и последних двух меток.)

- **Всегда ставим таймаут.** RDAP-сервер реестра может тормозить; `AbortController`
  на 10 секунд спасает поллер от зависания.

- **Регистратора достаём из vCard.** Имя регистратора лежит в `entities` с ролью
  `registrar`, внутри `vcardArray` — ищем свойство `fn` (formatted name).

## Как часто проверять: адаптивный интервал

Регистрация домена меняется редко — продлевается раз в год. Проверять её каждую
минуту бессмысленно. Но и раз в сутки мало: можно проскочить порог «за 1 день».
Решение — **интервал зависит от остатка**: спокойный режим вдали от даты,
учащение ближе к ней.

```ts
function checkIntervalMs(daysLeft: number | null): number {
  if (daysLeft == null) return 12 * HOUR_MS; // ещё не знаем — попробуем через 12 ч
  if (daysLeft > 30)    return DAY_MS;        // спокойно — раз в сутки
  if (daysLeft > 1)     return 6 * HOUR_MS;   // последний месяц — каждые 6 часов
  return HOUR_MS;                             // меньше суток — раз в час
}
```

## Предупреждать один раз на каждом пороге

Дальше — логика оповещений. Хочется предупредить за 30, 14, 7, 3 и 1 день до
окончания (и отдельно — когда уже истекло), но **каждое предупреждение отправить
ровно один раз**, а не спамить в каждом цикле проверки.

Приём простой: храним в БД поле `domainAlertDays` — самый срочный порог, о котором
уже уведомили. Шлём письмо, только если достигнут порог **более срочный**, чем
записанный. А если до окончания снова больше 30 дней (домен продлили) — сбрасываем
поле в `null`, чтобы при следующем приближении срока пороги отработали заново.

```ts
const ALERT_THRESHOLDS_D = [30, 14, 7, 3, 1];

function currentAlertLevel(daysLeft: number): number | null {
  if (daysLeft <= 0) return 0;                 // 0 = «истёк»
  let level: number | null = null;
  for (const t of ALERT_THRESHOLDS_D) {
    if (daysLeft <= t && (level === null || t < level)) level = t;
  }
  return level;                                 // null = до окончания больше 30 дней
}

// ...в проверке проекта:
const level = currentAlertLevel(info.daysLeft);
if (level === null) {
  nextAlertDays = null;                         // продлили — сбрасываем историю
} else if (project.domainAlertDays === null || level < project.domainAlertDays) {
  await notifyProjectDomain(project, level, info); // достигнут более срочный порог
  nextAlertDays = level;
}
```

Тот же паттерн («порог, о котором уже уведомили») мы используем и для SSL-серти­
фикатов — только там пороги в часах (за неделю, 3 дня, день, час), потому что
Let's Encrypt-сертификаты живут 90 дней и истекают куда чаще доменов.

## Итог

Если вам нужно программно узнать срок регистрации домена — не трогайте WHOIS.
RDAP даёт то же самое в виде HTTP + JSON, через `rdap.org` работает единым
запросом на любой распространённый TLD, а адаптивный интервал проверок плюс
«порог, о котором уже уведомили» превращают это в надёжные напоминания без спама.

---

*В [Logsy](https://logsy.ru) контроль срока регистрации домена и SSL-сертификата
включается одним тумблером в настройках проекта. Предупреждения приходят на email
и в Telegram за месяц, 2 недели, неделю, 3 дня и день до окончания. Бесплатный
тариф — без ограничения по времени.*
