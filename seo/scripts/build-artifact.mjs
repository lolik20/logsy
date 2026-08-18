// Сборка HTML-отчёта: ЦА + карта страниц с прошивкой запросов Wordstat.
import fs from "node:fs";
const rows = JSON.parse(fs.readFileSync("pagemap.json", "utf8"));

const EXISTS = new Set(["/","/for-owners","/for-marketers","/for-developers","/speed-test","/docs/api","/docs/api/sessions","/docs/api/session","/docs/for-agents","/errors/500","/errors/502","/errors/504","/errors/403","/errors/429","/errors/connection-refused","/errors/ssl-connection","/errors/too-many-redirects","/help/site-down","/help/sites-down-today","/help/site-not-opening","/help/payment-not-working","/help/site-unavailable","/tools/blocked","/tools/html-validator","/tools/utm-builder","/tools/dns","/tools/redirects","/tools/whois","/uptime","/uptime/api-monitoring","/uptime/payment-monitoring","/uptime/form-monitoring","/ssl-monitoring","/domain-monitoring","/error-logging","/session-replay","/feedback-widget","/tasks","/site-audit","/cookie-banner","/monitoring-from-russia","/for-ecommerce","/free","/pricing","/blog/rkn-notification","/blog/fix-code-errors-ai","/alternatives/yandex-metrika","/integrations/claude-code","/alternatives/webvisor","/blog/webvisor-limits","/blog/webvisor-not-working","/blog/webvisor-how-to"]);
const WAVE1_FORCE = new Set(["/", "/uptime", "/pricing", "/free", "/session-replay", "/ssl-monitoring", "/domain-monitoring", "/feedback-widget", "/for-owners", "/for-developers", "/for-marketers"]);

// Блоки перебираются по порядку: строка попадает в первый подошедший, поэтому
// юридический блок стоит раньше инструментов и гайдов — он забирает свои страницы.
const BLOCKS = [
  { id: "legal", title: "152-ФЗ, документы и согласия", hint: "Новая линия: проверка соответствия, генерация политики и оферты, галочка согласия с журналом", match: (r) => /^\/legal|^\/tools\/152fz|^\/blog\/(152fz|rkn-|pd-|consent-sample|mailing-consent)|^\/cookie-banner$/.test(r.url) },
  { id: "vibe", title: "Вайбкодинг, ИИ-агенты и API", hint: "Аудитория, у которой прод ломается каждый день, и агент, которому можно отдать ошибки", match: (r) => /^\/for-vibecoders|^\/integrations\/(claude-code|mcp|cursor|lovable|bolt|replit)|^\/docs\/|^\/blog\/(vibecoding|fix-code|ai-site|claude-code)/.test(r.url) },
  { id: "replay", title: "Запись сессий: дополнение к Вебвизору", hint: "Брендовый спрос на Вебвизор и страницы про то, что добавляется к его записям", match: (r) => /^\/session-replay|webvisor|^\/blog\/(screen-recording|user-behavior|scroll-map|click-map)/.test(r.url) },
  { id: "core", title: "Продукт и решения", hint: "Коммерческое ядро: одна страница на один функциональный блок сервиса", match: (r) => ["hub", "solution", "commercial"].includes(r.t) },
  { id: "tools", title: "Бесплатные инструменты", hint: "Точка входа под широкие проверочные запросы: инструмент отдаёт результат и уводит в панель", match: (r) => r.t === "tool" },
  { id: "errors", title: "Коды ошибок и сбои браузера", hint: "Самый ёмкий информационный трафик: человек уже в аварии и ищет причину", match: (r) => r.t === "info" && r.url.startsWith("/errors") },
  { id: "help", title: "Диагностика «не работает»", hint: "Запросы паники: сайт лёг, оплата не проходит, заявки не идут", match: (r) => r.t === "info" && r.url.startsWith("/help") },
  { id: "segments", title: "Страницы под сегменты ЦА", hint: "Продают не функцию, а сценарий конкретной роли; поисковой спрос слабый, конверсия высокая", match: (r) => r.t === "segment" },
  { id: "compare", title: "Альтернативы и сравнения", hint: "Перехват брендового спроса ушедших и тяжёлых сервисов", match: (r) => r.t === "compare" },
  { id: "integrations", title: "CMS, фреймворки, интеграции", hint: "«Подключить к моей платформе» — снимает главное возражение внедрения", match: (r) => r.t === "integration" },
  { id: "guides", title: "Гайды и блог", hint: "НЧ-хвост и вход в тему для тех, кто ещё не ищет сервис", match: (r) => r.t === "guide" },
];

const SEGMENTS = [
  {
    name: "Владелец сайта услуг",
    who: "Малый бизнес: клиника, автосервис, юрфирма, застройщик. Сайт — основной канал заявок, своего техотдела нет.",
    pain: "Узнаёт о падении от клиента или не узнаёт вообще. SSL истёк — браузер пугает посетителей красным.",
    features: ["Проверки раз в минуту", "Алерты на email и в Telegram", "Контроль SSL", "Контроль срока домена"],
    queries: [["сайт не работает", 122794], ["мониторинг сайта", 10315], ["проверить работает ли сайт", 532], ["срок регистрации домена", 288]],
    pages: ["/", "/uptime", "/ssl-monitoring", "/domain-monitoring", "/help/site-down"],
  },
  {
    name: "Интернет-магазин",
    who: "Владелец или менеджер магазина на Битриксе, Тильде, OpenCart. Деньги идут через корзину и платёжный шлюз.",
    pain: "Оплата молча отвалилась, корзина не добавляет товар — заказы падают, а в аналитике просто «меньше конверсий».",
    features: ["Проверка оплаты и входа POST-запросом", "Запись сессии на чекауте", "Виджет «Сообщить об ошибке»", "Задачи из обращений"],
    queries: [["не проходит оплата на сайте", 641], ["мониторинг интернет магазина", 62], ["не работает корзина на сайте", 15], ["поддержка интернет магазина", 1344]],
    pages: ["/uptime/payment-monitoring", "/for-ecommerce", "/help/payment-not-working", "/help/cart-not-working"],
  },
  {
    name: "Маркетолог и performance-специалист",
    who: "Ведёт платный трафик на лендинги и магазин, отвечает за стоимость заявки.",
    pain: "Бюджет продолжает литься на страницу со сломанной формой. Конверсия просела — непонятно, реклама или техника.",
    features: ["Запись сессий с UTM и источником", "Отвал формы виден в ленте событий", "Медленные запросы страницы", "Тест скорости"],
    queries: [["конверсия сайта", 2120], ["utm метки", 9470], ["скорость загрузки сайта", 2154], ["не приходят заявки с сайта", 45]],
    pages: ["/for-marketers", "/session-replay", "/uptime/form-monitoring", "/blog/conversion-drop", "/tools/utm-builder"],
  },
  {
    name: "Веб-студия и агентство на техподдержке",
    who: "Держит на поддержке от 5 до 200 клиентских сайтов, продаёт часы и SLA.",
    pain: "Клиент звонит раньше, чем сработал мониторинг. Нечем отчитаться за месяц доступности и нечем обосновать тариф поддержки.",
    features: ["Проекты и мониторы по клиентам", "История проверок и uptime", "Канбан задач с перепиской", "Контроль домена и SSL всех клиентов"],
    queries: [["техподдержка сайта услуги", 22], ["поддержка сайта тариф", 40], ["договор на техподдержку сайта", 4]],
    pages: ["/for-agencies", "/sla-reports", "/tasks", "/blog/support-sla", "/blog/monitoring-for-agency"],
    note: "Спрос в поиске почти нулевой — сегмент берётся смысловыми страницами, кейсами и прямыми касаниями, а не SEO.",
  },
  {
    name: "Фронтенд- и фулстек-разработчик",
    who: "Продуктовая команда или подрядчик, отвечает за прод после релиза.",
    pain: "«У меня не воспроизводится»: баг есть только у клиента, в консоли разработчика чисто, шагов воспроизведения нет.",
    features: ["JS-ошибки со стектрейсом", "Упавшие запросы с payload и заголовками", "Запись сессии как шаги repro", "Хлебные крошки перед ошибкой"],
    queries: [["sentry", 28241], ["ошибки javascript", 1364], ["error tracking", 371], ["консоль браузера ошибки", 712]],
    pages: ["/for-developers", "/error-logging", "/alternatives/sentry", "/errors/cors", "/blog/repro-prod-bug"],
  },
  {
    name: "Вайбкодер",
    who: "Собирает продукт в Claude Code, Cursor, Lovable или Replit. Кода не читает, консоль браузера видел один раз, прод выкатывает сам.",
    pain: "Сайт ломается почти каждый релиз, а вместо ошибки есть только «у меня не работает» от пользователя. Скормить агенту нечего — он гадает по скриншоту.",
    features: ["JS-ошибки со стектрейсом", "Упавшие запросы с телом и заголовками", "Запись сессии до момента сбоя", "Публичное API проекта — данные забирает агент"],
    queries: [["claude code", 59137], ["вайбкодинг", 22156], ["cursor ai", 11432], ["как исправить ошибку в коде", 2424]],
    pages: ["/for-vibecoders", "/integrations/claude-code", "/integrations/mcp", "/blog/fix-code-errors-ai", "/docs/for-agents"],
    note: "Брендовые запросы навигационные — заходить надо через ошибку и через «подключить агента», а не через слово «мониторинг».",
  },
  {
    name: "DevOps и SRE небольшой команды",
    who: "Один инженер на несколько сервисов; поднимать Zabbix и Grafana ради пяти сайтов невыгодно.",
    pain: "Нужны проверки эндпоинтов, кодов и таймингов с алертом в Telegram — без стека, агентов и дежурного дашборда.",
    features: ["Мониторинг API любым HTTP-методом", "Ожидаемый код ответа", "Время отклика и медленные запросы", "Публичное API сервиса"],
    queries: [["zabbix", 37259], ["мониторинг сервера", 17445], ["мониторинг api", 230], ["apm мониторинг", 9]],
    pages: ["/for-devops", "/uptime/api-monitoring", "/uptime/server-monitoring", "/alternatives/zabbix", "/alternatives/grafana"],
  },
  {
    name: "Служба поддержки и клиентский сервис",
    who: "Первая линия: принимает «у меня ничего не работает» без скриншотов и версии браузера.",
    pain: "Обращение приходит текстом без контекста, воспроизвести нечего, переписка живёт в личной почте.",
    features: ["Виджет обратной связи на сайте", "Обращение приходит вместе с сессией и записью", "Автозадача в канбане", "Ответ письмом из панели и из Telegram"],
    queries: [["форма обратной связи на сайт", 1017], ["сообщить об ошибке на сайте", 102], ["виджет обратной связи", 261]],
    pages: ["/feedback-widget", "/for-support", "/tasks", "/blog/bug-report"],
  },
  {
    name: "SaaS-сервис и продуктовый стартап",
    who: "Продаёт подписку, обещает доступность в договоре, растёт на инцидентах.",
    pain: "Клиенты узнают о сбое первыми и пишут в поддержку пачкой; публичного статуса нет, разбора инцидента тоже.",
    features: ["Проверки критичных сценариев", "История доступности", "Алерты на всю команду"],
    queries: [["статус страница", 3591], ["статус страница сервиса", 81], ["инцидент менеджмент", 0]],
    pages: ["/for-saas", "/status-page", "/sla-reports", "/blog/incident-postmortem"],
    note: "Статус-страница пока не реализована — самая дешёвая функция под готовый спрос.",
  },
  {
    name: "SEO-специалист и вебмастер",
    who: "Отвечает за трафик; техническая доступность и скорость — его метрики.",
    pain: "Падения и 5xx во время обхода роботом стоят позиций, битые ссылки и цепочки редиректов копятся незаметно.",
    features: ["Обход сайта и карта страниц", "Ошибки бэкенда по страницам", "Медленные запросы", "Тест скорости"],
    queries: [["аудит сайта", 6807], ["проверить редиректы", 167], ["битые ссылки на сайте", 123], ["проверка sitemap xml", 23]],
    pages: ["/site-audit", "/tools/broken-links", "/tools/redirects", "/blog/seo-and-uptime"],
  },
  {
    name: "Крупная компания и госсектор",
    who: "Юрист или ИБ рядом с ИТ: важны российская юрисдикция данных и 152-ФЗ.",
    pain: "Зарубежные аналитика и мониторинг отпадают по требованиям и по оплате; нужны cookie-баннер и корректное согласие.",
    features: ["Проверки и данные в РФ, оплата в рублях", "Баннер cookie и согласие", "Маскирование полей ввода в записях", "Ретеншн логов по тарифу"],
    queries: [["согласие на обработку персональных данных на сайте", 2649], ["баннер cookie", 442], ["проверка сайта из россии", 84]],
    pages: ["/for-enterprise", "/monitoring-from-russia", "/cookie-banner", "/blog/152fz-cookie", "/alternatives/import-substitution"],
  },
];

// Что уже написано в коде под юридическую линию (состояние на момент отчёта).
const BUILT = [
  {
    title: "Публичная проверка сайта",
    what: "Обход headless-браузером вынесен из админки: профиль на 6 страниц и 40 с, формы намеренно не отправляются — сайт чужой.",
    files: ["src/lib/siteScanner.ts", "src/app/api/site-check/route.ts"],
    detail: "Ограничения нагрузки: 2 обхода одновременно на процесс, 5 запусков с IP в час, повтор по домену 15 минут отдаёт прошлый отчёт.",
  },
  {
    title: "Проверка соответствия 152-ФЗ",
    what: "11 проверок по данным обхода: политика, галочки в формах, HTTPS, cookie, сторонние и зарубежные хосты, реквизиты оператора, оферта, уведомление в РКН.",
    files: ["src/lib/compliance.ts"],
    detail: "Каждая проверка несёт норму закона, что нашли и что делать; итог — балл 0–100 и уровень critical / risky / ok.",
  },
  {
    title: "Сигналы соответствия в сканере",
    what: "Обход теперь снимает подписи чекбоксов, ссылки внутри форм, плашку cookie, ИНН/ОГРН из подвала и все сторонние хосты.",
    files: ["src/lib/siteScanner.ts"],
    detail: "Ссылки на политику ставятся в начало очереди обхода — так видно, открывается документ или отдаёт 404.",
  },
  {
    title: "Генератор документов",
    what: "Политика, оферта и текст согласия рендерятся из реквизитов оператора и публикуются версиями-снимками по постоянной ссылке /l/<slug>/<doc>.",
    files: ["src/lib/legal.ts", "src/app/l/[slug]/[doc]/page.tsx"],
    detail: "Снимок нужен для доказательства: в журнале согласий записан номер версии, и через год видно, с каким текстом соглашался посетитель.",
  },
  {
    title: "Журнал согласий",
    what: "Keyless-эндпоинт по Origin принимает факт согласия: страница, форма, версии документов, IP, UA, время.",
    files: ["src/app/api/logger/consent/route.ts", "prisma/schema.prisma"],
    detail: "Это и есть то, что требуется предъявить при проверке — сама галочка без фиксации юридической силы не имеет.",
  },
  {
    title: "Конфигурация SDK",
    what: "Проектный конфиг отдаёт блок consent: режим STRICT / SOFT, текст галочки и адреса опубликованных документов.",
    files: ["src/app/api/logger/config/route.ts"],
    detail: "Фича включается только когда документы опубликованы — иначе ссылка вела бы в пустоту.",
  },
];

// Что осталось до запуска линии.
const TODO = [
  "Применить схему к базе: новые модели ProjectLegal, LegalDoc, Consent и поля SiteScan (db push — на вашей стороне).",
  "SDK: встраивание чекбокса в формы обычного DOM, блокировка отправки в режиме STRICT, отдельная галочка на рассылку.",
  "Панель: вкладка «Документы» — реквизиты оператора, кнопка публикации, журнал согласий с выгрузкой.",
  "Страницы /site-check и /tools/152fz-check с формой ввода домена и выводом отчёта.",
  "Довести баннер cookie до фиксации выбора и отложенной загрузки счётчиков.",
  "Вынести документацию API в публичные индексируемые страницы /docs/api, добавить llms.txt и OpenAPI-спеку.",
  "Собрать MCP-сервер поверх готового API: агент читает сессии и ошибки без обвязки.",
];

const GAPS = [
  { title: "Публичная статус-страница", why: "«статус страница» — 3 591 показ в месяц, спрос сформирован. У сервиса уже есть история проверок и uptime, не хватает публичного URL проекта.", pages: ["/status-page", "/blog/status-page-guide", "/for-saas"] },
  { title: "Агрегация кликов в тепловую карту", why: "Записи rrweb уже содержат клики и скролл. Тепловая карта даёт отдельную страницу и закрывает сравнение с Вебвизором и Hotjar.", pages: ["/session-replay/heatmaps", "/alternatives/hotjar"] },
  { title: "Отчёт скана как публичный инструмент", why: "Скан обходит страницы, ловит 4xx/5xx, формы и внешние скрипты — но живёт внутри панели. Публичная форма ввода домена открывает 24 инструментальные страницы.", pages: ["/site-audit", "/tools/security-scan", "/tools/broken-links"] },
  { title: "Отчёты SLA на экспорт", why: "Агентствам нужен документ для клиента за месяц. Данные проверок есть, нужен PDF-вывод и публичная ссылка.", pages: ["/sla-reports", "/for-agencies"] },
  { title: "Проверки из нескольких точек", why: "«проверить доступность сайта из другой страны», «проверка сайта из России» — сценарий блокировок и региональных сбоев. Сейчас проверка одна.", pages: ["/monitoring-from-russia", "/tools/blocked"] },
];

// Рынок 152-ФЗ: кто уже занимает спрос и чем занят. Частоты — измеренные, оценка
// расстановки игроков — экспертная, цены и доли в этой работе не проверялись.
const MARKET = [
  {
    name: "Бесплатные генераторы при конструкторах и хостингах",
    who: "Tilda, Битрикс24, хостинг-провайдеры, десятки сайтов-однодневок «политика за 2 минуты»",
    strong: "Ноль стоимости и мгновенный результат — забирают запрос «генератор политики конфиденциальности» (145) и его хвост.",
    weak: "Отдают текст и на этом заканчивают: ни проверки сайта, ни галочки в формах, ни доказательства согласия.",
  },
  {
    name: "Юридические конструкторы документов",
    who: "Сервисы платных шаблонов договоров и юрфирмы с пакетом «документы для сайта»",
    strong: "Юрист в контуре, документ под конкретный бизнес, ответственность за текст.",
    weak: "Разовая покупка без технической части: документ лежит в PDF, сайт при этом продолжает нарушать.",
  },
  {
    name: "Сервисы cookie-баннеров",
    who: "CookieScript, Cookiebot, Usercentrics и аналоги",
    strong: "Готовый баннер с категориями согласия и блокировкой скриптов до выбора.",
    weak: "Зарубежные: оплата в валюте, а сам факт передачи данных за границу добавляет риск по ст. 12 152-ФЗ.",
  },
  {
    name: "Технические сканеры сайта",
    who: "SEO-аудиторы, антивирусные сканеры, сервисы проверки доступности",
    strong: "Занимают широкий проверочный спрос: «проверить сайт» и его производные.",
    weak: "Смотрят на ошибки, вирусы и мета-теги — юридический слой не проверяют вообще.",
  },
];

// Сравнение с Вебвизором. Слева — что закрывает Вебвизор, справа — что добавляет Logsy.
// Ограничения Метрики стоит перепроверять перед публикацией: они меняются.
const WITH_WEBVISOR = [
  { row: "Видео сессии посетителя", webvisor: "Есть — это его основная функция", logsy: "Есть: rrweb-запись с таймлайном и перемоткой" },
  { row: "Карта кликов и скроллинга", webvisor: "Есть, агрегированная по страницам", logsy: "Клики и скролл пишутся в сессию; агрегация в карту — в работе" },
  { row: "JS-ошибки со стектрейсом", webvisor: "Нет", logsy: "Есть: ошибка, стектрейс, страница и момент в записи" },
  { row: "Упавшие и медленные запросы", webvisor: "Нет", logsy: "Есть: код, время, тело запроса и заголовки" },
  { row: "Метки сбоев на дорожке записи", webvisor: "Нет", logsy: "Есть: клик по метке перематывает к моменту сбоя" },
  { row: "Жалоба посетителя внутри сессии", webvisor: "Нет", logsy: "Виджет «Сообщить об ошибке» кладёт обращение в ту же сессию" },
  { row: "Задача по обращению и переписка", webvisor: "Нет", logsy: "Канбан с ответом на почту прямо из карточки и из Telegram" },
  { row: "Доступность сайта, SSL и срок домена", webvisor: "Нет", logsy: "Мониторинг раз в минуту с алертами" },
  { row: "Доступ к сырым событиям", webvisor: "Только выгрузки Метрики", logsy: "Публичное API проекта: сессии и события в JSON" },
  { row: "Цена", webvisor: "Бесплатно", logsy: "Бесплатный объём плюс доплата за сессии и срок хранения" },
  { row: "Роль на сайте", webvisor: "Стандарт рынка: трафик, цели, поведение", logsy: "Технический слой рядом: причины сбоев" },
];

const tierClass = { "ВЧ": "hi", "СЧ": "mid", "НЧ": "lo", "мНЧ": "xlo", "mix": "mix" };
const fmtNum = (n) => n.toLocaleString("ru-RU");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wave(r) {
  if (WAVE1_FORCE.has(r.url) || r.focus >= 5000) return 1;
  if (r.focus >= 300) return 2;
  return 3;
}

const enriched = rows.map((r) => ({ ...r, wave: wave(r), exists: EXISTS.has(r.url) }));
const waveCount = (w) => enriched.filter((r) => r.wave === w).length;
const totalFocus = enriched.reduce((a, r) => a + r.focus, 0);
const totalAll = enriched.reduce((a, r) => a + r.total, 0);
const totalQueries = enriched.reduce((a, r) => a + r.core.length + r.tail.length, 0);

function chips(list) {
  if (!list.length) return '<span class="empty">—</span>';
  return list.map(([p, n, t]) => `<span class="kw ${tierClass[t] || "xlo"}" title="${esc(t === "mix" ? "размытый интент" : t)}"><span class="kw-p">${esc(p)}</span><span class="kw-n">${fmtNum(n)}</span></span>`).join("");
}

function tableFor(block) {
  const list = enriched.filter(block.match).sort((a, b) => b.focus - a.focus);
  const body = list.map((r) => `
      <tr data-wave="${r.wave}" data-seg="${esc(r.s)}" data-search="${esc((r.url + " " + r.h1 + " " + r.core.map((c) => c[0]).join(" ") + " " + r.tail.map((c) => c[0]).join(" ")).toLowerCase())}">
        <td class="c-url"><code>${esc(r.url)}</code>${r.exists ? '<span class="badge live">есть</span>' : ""}<span class="badge w w${r.wave}">волна ${r.wave}</span></td>
        <td class="c-h1">${esc(r.h1)}${r.note ? `<span class="note">${esc(r.note)}</span>` : ""}<span class="seg">${esc(r.s)}</span></td>
        <td class="c-kw">${chips(r.core)}</td>
        <td class="c-kw">${chips(r.tail)}</td>
        <td class="c-num">${fmtNum(r.focus)}<span class="sub">${fmtNum(r.total)}</span></td>
      </tr>`).join("");
  return `
    <section class="block" id="${block.id}" data-block="${block.id}">
      <header class="block-head">
        <h3>${esc(block.title)}</h3>
        <span class="count">${list.length} страниц · ${fmtNum(list.reduce((a, r) => a + r.focus, 0))} целевых показов</span>
        <p>${esc(block.hint)}</p>
      </header>
      <div class="scroll">
        <table>
          <thead><tr><th>URL</th><th>H1 и сегмент</th><th>Ядро запроса</th><th>Прошивка хвостом</th><th>Частота<span class="sub">целевая / всего</span></th></tr></thead>
          <tbody>${body}
          </tbody>
        </table>
      </div>
    </section>`;
}

const segCards = SEGMENTS.map((s, i) => `
      <article class="seg-card">
        <div class="seg-top"><span class="seg-i">${String(i + 1).padStart(2, "0")}</span><h3>${esc(s.name)}</h3></div>
        <p class="who">${esc(s.who)}</p>
        <p class="pain"><span>Боль</span>${esc(s.pain)}</p>
        <ul class="feats">${s.features.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="seg-kw">${s.queries.map(([p, n]) => `<span class="kw ${n >= 10000 ? "hi" : n >= 1000 ? "mid" : n >= 100 ? "lo" : "xlo"}"><span class="kw-p">${esc(p)}</span><span class="kw-n">${fmtNum(n)}</span></span>`).join("")}</div>
        <div class="seg-pages">${s.pages.map((p) => `<code>${esc(p)}</code>`).join("")}</div>
        ${s.note ? `<p class="seg-note">${esc(s.note)}</p>` : ""}
      </article>`).join("");

const html = `<title>Карта запросов Logsy</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --ground: #f4f5fb;
    --surface: #ffffff;
    --surface-2: #eceef8;
    --line: #dcdfef;
    --line-soft: #e8eaf5;
    --ink: #14162e;
    --ink-2: #454a6e;
    --ink-3: #6d7395;
    --accent: #4f5fe6;
    --accent-ink: #3a48c9;
    --accent-soft: #e9ebfd;
    --hi: #b8400c;
    --hi-soft: #fdeee6;
    --mid: #0c7367;
    --mid-soft: #e4f4f1;
    --lo: #4a5170;
    --lo-soft: #eceef6;
    --shadow: 0 1px 2px rgba(20, 22, 46, .05), 0 12px 32px rgba(20, 22, 46, .06);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground: #0c0e1c;
      --surface: #14172a;
      --surface-2: #1b1f36;
      --line: #2a2f4c;
      --line-soft: #232741;
      --ink: #eceefb;
      --ink-2: #b3b8d6;
      --ink-3: #8b91b4;
      --accent: #8b95f5;
      --accent-ink: #a6aef8;
      --accent-soft: #232a52;
      --hi: #ff9d6b;
      --hi-soft: #3a2418;
      --mid: #5ed6c2;
      --mid-soft: #14322e;
      --lo: #a9b0ce;
      --lo-soft: #232741;
      --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 16px 40px rgba(0, 0, 0, .35);
    }
  }
  :root[data-theme="dark"] {
    --ground: #0c0e1c;
    --surface: #14172a;
    --surface-2: #1b1f36;
    --line: #2a2f4c;
    --line-soft: #232741;
    --ink: #eceefb;
    --ink-2: #b3b8d6;
    --ink-3: #8b91b4;
    --accent: #8b95f5;
    --accent-ink: #a6aef8;
    --accent-soft: #232a52;
    --hi: #ff9d6b;
    --hi-soft: #3a2418;
    --mid: #5ed6c2;
    --mid-soft: #14322e;
    --lo: #a9b0ce;
    --lo-soft: #232741;
    --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 16px 40px rgba(0, 0, 0, .35);
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font: 400 15px/1.6 "Golos Text", "Segoe UI", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1320px; margin: 0 auto; padding: 0 20px 80px; }
  code, .num, .kw-n { font-family: "JetBrains Mono", ui-monospace, monospace; font-variant-numeric: tabular-nums; }
  h1, h2, h3 { text-wrap: balance; margin: 0; letter-spacing: -.015em; }
  a { color: var(--accent-ink); }

  /* Шапка */
  .top { padding: 56px 0 28px; border-bottom: 1px solid var(--line); }
  .eyebrow { font: 500 12px/1 "JetBrains Mono", monospace; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-ink); }
  h1 { font-size: clamp(30px, 4.4vw, 52px); font-weight: 700; margin: 14px 0 12px; }
  .lead { max-width: 66ch; color: var(--ink-2); font-size: 17px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 18px; font: 400 13px/1.4 "JetBrains Mono", monospace; color: var(--ink-3); }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 28px 0 0; }
  .kpi { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); }
  .kpi b { display: block; font: 500 28px/1.1 "JetBrains Mono", monospace; letter-spacing: -.02em; }
  .kpi span { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-3); }

  section.part { padding-top: 56px; }
  .part-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; margin-bottom: 8px; }
  .part-head h2 { font-size: 26px; font-weight: 600; }
  .part-head .tag { font: 500 12px/1 "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-3); }
  .part > p.intro { max-width: 74ch; color: var(--ink-2); margin: 0 0 24px; }

  /* Метод */
  .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 12px; }
  .step { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
  .step b { display: block; font-size: 14px; margin-bottom: 6px; }
  .step p { margin: 0; font-size: 13.5px; color: var(--ink-2); }
  .step code { font-size: 12.5px; color: var(--ink-3); }

  /* Сегменты */
  .segs { display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 14px; }
  .seg-card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow); }
  .seg-top { display: flex; align-items: baseline; gap: 10px; }
  .seg-i { font: 500 12px/1 "JetBrains Mono", monospace; color: var(--accent-ink); background: var(--accent-soft); padding: 5px 7px; border-radius: 6px; }
  .seg-card h3 { font-size: 18px; font-weight: 600; }
  .seg-card p { margin: 0; font-size: 14px; color: var(--ink-2); }
  .seg-card .pain { border-left: 2px solid var(--hi); padding-left: 12px; }
  .seg-card .pain span { display: block; font: 500 11px/1 "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--hi); margin-bottom: 5px; }
  .feats { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .feats li { font-size: 12.5px; background: var(--surface-2); border: 1px solid var(--line-soft); border-radius: 6px; padding: 4px 8px; color: var(--ink-2); }
  .seg-kw { display: flex; flex-wrap: wrap; gap: 5px; }
  .seg-pages { display: flex; flex-wrap: wrap; gap: 5px; padding-top: 4px; border-top: 1px dashed var(--line); }
  .seg-pages code { font-size: 12px; color: var(--accent-ink); }
  .seg-note { font-size: 12.5px !important; color: var(--ink-3) !important; }

  /* Ключи */
  .kw { display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; padding: 3px 6px; font-size: 12.5px; line-height: 1.25; background: var(--lo-soft); border: 1px solid transparent; max-width: 100%; }
  .kw-p { overflow-wrap: anywhere; }
  .kw-n { font-size: 11.5px; opacity: .8; }
  .kw.hi { background: var(--hi-soft); color: var(--hi); }
  .kw.mid { background: var(--mid-soft); color: var(--mid); }
  .kw.lo { background: var(--lo-soft); color: var(--lo); }
  .kw.xlo { background: transparent; border-color: var(--line); color: var(--ink-3); }
  .kw.mix { background: transparent; border: 1px dashed var(--line); color: var(--ink-3); }
  .c-kw { display: flex; flex-wrap: wrap; gap: 4px; }

  /* Панель фильтров */
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: 12px 0; margin-bottom: 8px; background: color-mix(in srgb, var(--ground) 88%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); }
  .toolbar input { flex: 1 1 220px; min-width: 180px; padding: 9px 12px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: 400 14px "Golos Text", sans-serif; }
  .toolbar input:focus-visible, .chip:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { cursor: pointer; border: 1px solid var(--line); background: var(--surface); color: var(--ink-2); border-radius: 999px; padding: 7px 12px; font: 500 13px "Golos Text", sans-serif; }
  .chip[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
  :root[data-theme="dark"] .chip[aria-pressed="true"], :root:not([data-theme="light"]) .chip[aria-pressed="true"] { color: #0c0e1c; }
  .hint { font-size: 12.5px; color: var(--ink-3); }

  /* Таблицы */
  .block { margin-top: 34px; }
  .block-head h3 { font-size: 19px; font-weight: 600; display: inline; margin-right: 10px; }
  .block-head .count { font: 400 12.5px "JetBrains Mono", monospace; color: var(--ink-3); }
  .block-head p { margin: 6px 0 12px; font-size: 14px; color: var(--ink-2); max-width: 76ch; }
  .scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); box-shadow: var(--shadow); }
  table { width: 100%; border-collapse: collapse; min-width: 940px; }
  th { text-align: left; font: 500 11.5px/1.3 "JetBrains Mono", monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); padding: 12px 14px; border-bottom: 1px solid var(--line); background: var(--surface-2); vertical-align: bottom; }
  th .sub { display: block; text-transform: none; letter-spacing: 0; opacity: .75; font-size: 10.5px; }
  td { padding: 12px 14px; border-bottom: 1px solid var(--line-soft); vertical-align: top; font-size: 14px; }
  tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: var(--surface-2); }
  .c-url { white-space: nowrap; }
  .c-url code { font-size: 12.5px; color: var(--accent-ink); }
  .c-h1 { min-width: 220px; max-width: 300px; }
  .c-kw { min-width: 240px; }
  .c-num { text-align: right; white-space: nowrap; font-family: "JetBrains Mono", monospace; font-variant-numeric: tabular-nums; font-size: 13.5px; }
  .c-num .sub, .seg, .note { display: block; }
  .c-num .sub { font-size: 11.5px; color: var(--ink-3); }
  .seg { margin-top: 5px; font: 400 11.5px "JetBrains Mono", monospace; color: var(--ink-3); }
  .note { margin-top: 6px; font-size: 12px; color: var(--hi); }
  .badge { display: inline-block; margin-left: 6px; padding: 2px 6px; border-radius: 5px; font: 500 10.5px/1.5 "JetBrains Mono", monospace; text-transform: uppercase; letter-spacing: .06em; }
  .badge.live { background: var(--mid-soft); color: var(--mid); }
  .badge.w { border: 1px solid var(--line); color: var(--ink-3); }
  .badge.w1 { border-color: var(--accent); color: var(--accent-ink); }
  .empty { color: var(--ink-3); }

  /* Волны и пробелы */
  .waves { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; }
  .wavec { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 20px; box-shadow: var(--shadow); }
  .wavec h3 { font-size: 17px; font-weight: 600; }
  .wavec .n { font: 500 13px "JetBrains Mono", monospace; color: var(--accent-ink); }
  .wavec ul { margin: 12px 0 0; padding-left: 18px; font-size: 14px; color: var(--ink-2); }
  .wavec li { margin-bottom: 6px; }
  .gaps { display: grid; gap: 10px; }
  .gap { display: grid; grid-template-columns: minmax(180px, 250px) 1fr; gap: 16px; background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--hi); border-radius: 12px; padding: 16px 18px; }
  .gap b { font-size: 15px; }
  .gap p { margin: 0; font-size: 14px; color: var(--ink-2); }
  .gap .pgs { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
  .gap code { font-size: 12px; color: var(--accent-ink); }
  /* Крючки под вайбкодеров */
  .hooks { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
  .hook { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; box-shadow: var(--shadow); }
  .hook .n { font: 500 11px/1 "JetBrains Mono", monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--accent-ink); }
  .hook h3 { margin: 8px 0; font-size: 16px; font-weight: 600; }
  .hook p { margin: 0; font-size: 14px; color: var(--ink-2); }
  .hook code { font-size: 12.5px; color: var(--accent-ink); }

  /* Сравнение с Вебвизором */
  table.vs { min-width: 720px; }
  table.vs td { font-size: 14px; }
  table.vs .win { color: var(--mid); font-weight: 500; }

  /* Что уже в коде */
  .built { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
  .built-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; box-shadow: var(--shadow); }
  .built-card h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .built-card p { margin: 0 0 8px; font-size: 14px; color: var(--ink-2); }
  .built-card p.sub { font-size: 13px; color: var(--ink-3); }
  .built-card .files { display: flex; flex-wrap: wrap; gap: 6px; }
  .built-card code { font-size: 11.5px; color: var(--accent-ink); background: var(--accent-soft); padding: 3px 6px; border-radius: 5px; }
  .todo { margin-top: 14px; background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 12px; padding: 16px 18px; }
  .todo b { display: block; margin-bottom: 6px; font-size: 15px; }
  .todo ul { margin: 0; padding-left: 18px; font-size: 14px; color: var(--ink-2); }
  .todo li { margin-bottom: 5px; }

  /* Рынок */
  .market { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
  .market-card { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 18px; box-shadow: var(--shadow); display: flex; flex-direction: column; gap: 10px; }
  .market-card h3 { font-size: 16px; font-weight: 600; }
  .market-card p { margin: 0; font-size: 14px; color: var(--ink-2); }
  .market-card .who { font-size: 13px; color: var(--ink-3); }
  .market-card span { display: block; font: 500 11px/1 "JetBrains Mono", monospace; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 4px; }
  .market-card .strong span { color: var(--mid); }
  .market-card .weak span { color: var(--hi); }
  .niche { margin-top: 14px; background: var(--accent-soft); border-radius: 12px; padding: 18px; }
  .niche b { display: block; margin-bottom: 6px; font-size: 15px; }
  .niche p { margin: 0; font-size: 14px; color: var(--ink-2); }

  .caveats { display: grid; gap: 10px; max-width: 90ch; }
  .caveat { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
  .caveat b { display: block; margin-bottom: 4px; font-size: 15px; }
  .caveat p { margin: 0; font-size: 14px; color: var(--ink-2); }
  footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 13px; color: var(--ink-3); }
  @media (max-width: 720px) {
    .gap { grid-template-columns: 1fr; }
    .top { padding-top: 36px; }
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
</style>

<div class="wrap">
  <header class="top">
    <p class="eyebrow">Logsy · семантика и структура сайта</p>
    <h1>Карта запросов: ${enriched.length} страниц под функционал сервиса</h1>
    <p class="lead">Сегменты аудитории собраны из того, что сервис реально умеет: мониторинг доступности, SSL и домена, логирование фронтенд-ошибок, запись сессий, обратная форма с задачами, тест скорости и обход сайта. Под каждый сегмент — страницы, в каждую страницу прошит запрос-ядро и хвост из Wordstat.</p>
    <div class="meta">
      <span>частотности: Яндекс.Wordstat, Россия, ${new Date().toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</span>
      <span>источник: Директ API v4 (live), 280 базовых фраз → 10 201 расширение</span>
      <span>после чистки: 7 361 запрос</span>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${enriched.length}</b><span>страниц в карте</span></div>
      <div class="kpi"><b>${fmtNum(totalQueries)}</b><span>запросов прошито без пересечений</span></div>
      <div class="kpi"><b>${fmtNum(totalFocus)}</b><span>целевых показов в месяц</span></div>
      <div class="kpi"><b>${fmtNum(totalAll)}</b><span>всего показов, включая размытые</span></div>
    </div>
  </header>

  <section class="part">
    <div class="part-head"><h2>Как считалось</h2><span class="tag">метод</span></div>
    <p class="intro">Ни одна цифра не придумана: каждая фраза и её частотность взяты из Wordstat через API, ключ — из <code>.env</code> проекта.</p>
    <div class="steps">
      <div class="step"><b>1. Разбор функционала</b><p>По README и коду: мониторы, SSL и RDAP-контроль домена, логирование, rrweb-записи, виджет обращений, канбан, тест скорости, обход сайта, cookie-баннер, публичное API.</p></div>
      <div class="step"><b>2. Сбор частотностей</b><p>280 базовых фраз семью проходами через <code>CreateNewWordstatReport</code>, регион 225 (Россия), с расширениями «искали вместе».</p></div>
      <div class="step"><b>3. Чистка пула</b><p>Отброшены потребительские и омонимичные интенты: провайдеры, госпорталы, игровые серверы, автоошибки, банки. Осталось 7 361 запрос.</p></div>
      <div class="step"><b>4. Прошивка без пересечений</b><p>Каждый запрос закреплён ровно за одной страницей: сначала ядро, потом хвост. Узкие страницы забирают фразы раньше широких — это защита от каннибализации.</p></div>
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Целевая аудитория</h2><span class="tag">${SEGMENTS.length} сегментов</span></div>
    <p class="intro">Сегменты выведены из функционала, а не из общих рассуждений: если у сервиса нет функции под боль сегмента — сегмента здесь нет. В каждой карточке частотность триггерных запросов сегмента.</p>
    <div class="segs">${segCards}
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Карта страниц</h2><span class="tag">${enriched.length} URL · 8 блоков</span></div>
    <p class="intro">Столбец «Ядро» — запрос, под который пишется title и H1. «Прошивка хвостом» — фразы для подзаголовков, FAQ и текста; пунктирные — размытый интент (частота реальна, но люди ищут другое; берём только как побочный трафик). Правая колонка: целевая частота против общей.</p>
    <div class="toolbar">
      <input id="q" type="search" placeholder="Поиск по URL, заголовку и запросам" aria-label="Поиск по карте страниц">
      <div class="chips" id="waveChips">
        <button class="chip" type="button" aria-pressed="false" data-wave="1">Волна 1 · ${waveCount(1)}</button>
        <button class="chip" type="button" aria-pressed="false" data-wave="2">Волна 2 · ${waveCount(2)}</button>
        <button class="chip" type="button" aria-pressed="false" data-wave="3">Волна 3 · ${waveCount(3)}</button>
      </div>
      <span class="hint" id="stat"></span>
    </div>
${BLOCKS.map(tableFor).join("\n")}
  </section>

  <section class="part">
    <div class="part-head"><h2>Вайбкодеры: самый ёмкий из новых кластеров</h2><span class="tag">≈43 000 целевых показов</span></div>
    <p class="intro">Человек собрал сайт в Claude Code или Lovable, выкатил — и прод ломается каждый день. Отладить он не умеет: у него нет ни консоли, ни логов, ни понимания, что именно упало. Это ровно та боль, которую Logsy закрывает, и спрос здесь больше, чем во всём мониторинге: <b>claude code</b> — 59 137, <b>вайбкодинг</b> — 22 156, <b>cursor ai</b> — 11 432, <b>replit</b> — 9 072, <b>mcp сервер</b> — 5 903, <b>как исправить ошибку в коде</b> — 2 424.</p>
    <div class="hooks">
      <article class="hook">
        <span class="n">Крючок 1</span>
        <h3>Агент чинит то, что видит</h3>
        <p>Обычный цикл вайбкодера: «у меня не работает» → скриншот в чат → агент гадает. С Logsy агент получает сессию: стектрейс ошибки, упавший запрос с телом и заголовками, шаги пользователя до сбоя. Продающая формулировка — «покажите Клоду, что именно сломалось у клиента», а не «мониторинг доступности».</p>
      </article>
      <article class="hook">
        <span class="n">Крючок 2</span>
        <h3>Подключение в два клика</h3>
        <p>Одна строка скрипта на сайт и ключ проекта в конфиг агента. Публичное API уже отдаёт сессии и события в JSON — остаётся оформить его как MCP-сервер и как <code>llms.txt</code>, чтобы агент сам находил документацию и ходил за данными без обвязки.</p>
      </article>
      <article class="hook">
        <span class="n">Крючок 3</span>
        <h3>Заходить через боль, а не через бренд</h3>
        <p>Брендовые запросы вроде <code>claude code</code> навигационные — по ним идут скачивать и покупать подписку. Конверсия живёт в связке «ошибка + ИИ»: <b>как исправить ошибку в коде</b> (2 424), <b>сделать сайт нейросетью</b> (898), <b>вайбкодинг что это</b> (6 243). Там и надо стоять со своим ответом.</p>
      </article>
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Рядом с Вебвизором</h2><span class="tag">дополнение, а не замена</span></div>
    <p class="intro">Спроса на «запись сессий» в России почти нет: <b>запись сессий пользователей</b> — 15 показов, <b>сервис записи сессий</b> — 10, <b>session replay</b> — 15. Зато есть брендовый спрос на Вебвизор: <b>вебвизор</b> — 3 332, <b>яндекс вебвизор</b> — 1 136, <b>метрика вебвизор</b> — 579, <b>вебвизор яндекс метрика</b> — 463. Это люди, у которых Метрика уже стоит, — спорить с ней бессмысленно и не нужно. Позиция блока: Вебвизор отвечает, <i>что делал</i> посетитель, Logsy добавляет, <i>что именно сломалось</i>. Отсюда и страницы: как включить, почему не пишет, чего в записи не видно.</p>
    <div class="scroll">
      <table class="vs">
        <thead><tr><th>Что нужно увидеть</th><th>Вебвизор</th><th>Logsy рядом с ним</th></tr></thead>
        <tbody>
${WITH_WEBVISOR.map((r) => `          <tr><td class="c-h1">${esc(r.row)}</td><td>${esc(r.webvisor)}</td><td class="win">${esc(r.logsy)}</td></tr>`).join("\n")}
        </tbody>
      </table>
    </div>
    <p class="hint" style="margin-top:10px">Ограничения Метрики меняются — перед публикацией сравнения перепроверьте актуальные условия хранения и состав данных Вебвизора.</p>
  </section>

  <section class="part">
    <div class="part-head"><h2>Линия 152-ФЗ: что уже в коде</h2><span class="tag">${BUILT.length} блока</span></div>
    <p class="intro">Логика обхода вынесена из админки в публичный эндпоинт, к отчёту добавлена проверка соответствия, а в панели появились модели документов и журнал согласий. Ниже — что именно написано и где это лежит.</p>
    <div class="built">
${BUILT.map((b) => `      <article class="built-card">
        <h3>${esc(b.title)}</h3>
        <p>${esc(b.what)}</p>
        <p class="sub">${esc(b.detail)}</p>
        <div class="files">${b.files.map((f) => `<code>${esc(f)}</code>`).join("")}</div>
      </article>`).join("\n")}
    </div>
    <div class="todo">
      <b>Осталось до запуска линии</b>
      <ul>${TODO.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Рынок 152-ФЗ</h2><span class="tag">кто уже занимает спрос</span></div>
    <p class="intro">Спрос в этом кластере устроен характерно: «объясните, что от меня хотят» ищут в десятки раз чаще, чем «сделайте за меня». <b>152 фз персональные данные</b> — 31 901 показ, <b>уведомление в Роскомнадзор</b> в трёх формулировках — 13 558, а <b>генератор политики конфиденциальности</b> — всего 145. Значит трафик берётся объясняющими страницами, а деньги — инструментом в конце статьи.</p>
    <div class="market">
${MARKET.map((m) => `      <article class="market-card">
        <h3>${esc(m.name)}</h3>
        <p class="who">${esc(m.who)}</p>
        <p class="strong"><span>Чем берут</span>${esc(m.strong)}</p>
        <p class="weak"><span>Где не дотягивают</span>${esc(m.weak)}</p>
      </article>`).join("\n")}
    </div>
    <div class="niche">
      <b>Свободное место</b>
      <p>Никто из четырёх категорий не закрывает цепочку целиком: проверили сайт → показали конкретные нарушения → сгенерировали документы под реквизиты → поставили галочку в формы одной строкой → сохранили доказательства согласий → продолжаем следить, когда на сайте появится новая форма. У Logsy для этой цепочки уже есть обход, SDK на сайтах клиентов и мониторинг — остальное достраивается, а не строится с нуля.</p>
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Порядок запуска</h2><span class="tag">три волны</span></div>
    <p class="intro">Волна определяется целевой частотой и готовностью функционала: сначала то, что уже можно показать в продукте.</p>
    <div class="waves">
      <div class="wavec">
        <span class="n">Волна 1 · ${waveCount(1)} страниц</span>
        <h3>Спрос есть, продукт готов</h3>
        <ul>
          <li>Диагностические страницы аварий: «сайт не работает», «не открывается», коды 500 / 502 / 503 / 504 / 403 / 429.</li>
          <li>Бесплатные инструменты на готовых механизмах: доступность, SSL, whois, заголовки, пинг, DNS, скорость.</li>
          <li>Коммерческое ядро: главная, uptime, SSL и домен, логирование, запись сессий, тарифы.</li>
        </ul>
      </div>
      <div class="wavec">
        <span class="n">Волна 2 · ${waveCount(2)} страниц</span>
        <h3>Средний спрос и перехват брендов</h3>
        <ul>
          <li>Альтернативы: Sentry, Zabbix, Вебвизор, Hotjar, UptimeRobot, Grafana.</li>
          <li>Остальные инструменты и «не работает»-сценарии: оплата, корзина, заявки, мобильные.</li>
          <li>Сегментные страницы: ecommerce, агентства, DevOps, поддержка.</li>
        </ul>
      </div>
      <div class="wavec">
        <span class="n">Волна 3 · ${waveCount(3)} страниц</span>
        <h3>Хвост, платформы и смысловые страницы</h3>
        <ul>
          <li>Гайды и блог — вход в тему и внутренняя перелинковка на решения.</li>
          <li>CMS и SDK: Битрикс, WordPress, Tilda, Next.js, React, GTM, webhook.</li>
          <li>Страницы без поискового спроса — под конверсию и прямые касания, не под трафик.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Где спрос упирается в продукт</h2><span class="tag">${GAPS.length} доработки</span></div>
    <p class="intro">Эти страницы стоят в карте, но честно закрыть запрос сейчас нечем. Доработки маленькие — данные для них в сервисе уже есть.</p>
    <div class="gaps">
${GAPS.map((g) => `      <div class="gap"><div><b>${esc(g.title)}</b><div class="pgs">${g.pages.map((p) => `<code>${esc(p)}</code>`).join("")}</div></div><p>${esc(g.why)}</p></div>`).join("\n")}
    </div>
  </section>

  <section class="part">
    <div class="part-head"><h2>Оговорки</h2><span class="tag">как читать цифры</span></div>
    <div class="caveats">
      <div class="caveat"><b>Размытые ВЧ — это не ваш трафик целиком</b><p>«проверить сайт» (411 111), «карта сайта» (193 952), «яндекс метрика» (106 085) собирают запросы про мошенничество, географические карты и вход в чужой кабинет. Такие фразы помечены пунктиром и не входят в целевую частоту — ориентируйтесь на левое число в правой колонке.</p></div>
      <div class="caveat"><b>«Мониторинг серверов» — это игровые серверы</b><p>17 446 показов у «мониторинг серверов» и 14 347 у «пинг сервера» дают списки серверов CS, Rust и GTA, а не поиск системы мониторинга. Запросы помечены размытыми, страница <code>/uptime/server-monitoring</code> переприцелена на «мониторинг доступности сервера» — там честные 190 показов, и это надо принимать как есть.</p></div>
      <div class="caveat"><b>Юридический кластер огромный, но почти весь — про закон вообще</b><p>«персональные данные» (512 545) и «обработка персональных данных» (198 482) ищут студенты, кадровики и юристы. К сайтам относится узкая полоса: «политика конфиденциальности для сайта» (1 283), «cookie файлы согласие сайт» (816), «проверка роскомнадзора сайта» (503), «галочка согласия» (230). Целевая частота блока считается только по ней.</p></div>
      <div class="caveat"><b>На «запись сессий» спроса нет — есть спрос на Вебвизор</b><p>Категория в России не сформирована: «запись сессий пользователей» — 15 показов. Поэтому блок записи построен вокруг брендового спроса на Вебвизор (3 332 + 1 136 + 579 + 463) и вокруг болей, которые он не закрывает. Продавать глубину надо на сравнении, а не на объёме поиска.</p></div>
      <div class="caveat"><b>Частота Wordstat — широкое соответствие</b><p>Цифры сняты без операторов кавычек и восклицательного знака: это сумма всех уточнений фразы, а не точный спрос. Перед вёрсткой title стоит проверить ядро в кавычках — порядок величины сохранится, абсолют упадёт.</p></div>
      <div class="caveat"><b>60 страниц с нулевой частотой оставлены осознанно</b><p>«/for-saas», «/help/hacked», «/sdk/react» и подобные не имеют измеримого спроса в РФ. Они нужны для перелинковки, ответов на возражения и посадки из рассылок и статей — но планировать по ним трафик нельзя.</p></div>
      <div class="caveat"><b>Спрос B2B здесь тонкий, а информационный — толстый</b><p>Прямых коммерческих запросов на мониторинг в РФ мало: «мониторинг доступности сайта» — 166. Поэтому основной объём вынесен в аварийные и инструментальные страницы: человек приходит с «ошибка 502», получает разбор и бесплатную проверку, а мониторинг предлагается как способ не повторять.</p></div>
    </div>
  </section>

  <footer>Данные: Яндекс.Wordstat через Директ API, регион «Россия», широкое соответствие. Прошивка запросов не пересекается: одна фраза — одна страница.</footer>
</div>

<script>
  (function () {
    var rows = Array.prototype.slice.call(document.querySelectorAll("tbody tr"));
    var q = document.getElementById("q");
    var stat = document.getElementById("stat");
    var chips = Array.prototype.slice.call(document.querySelectorAll("#waveChips .chip"));
    var activeWave = null;

    function apply() {
      var term = q.value.trim().toLowerCase();
      var shown = 0;
      rows.forEach(function (tr) {
        var okWave = !activeWave || tr.getAttribute("data-wave") === activeWave;
        var okTerm = !term || tr.getAttribute("data-search").indexOf(term) > -1;
        var vis = okWave && okTerm;
        tr.hidden = !vis;
        if (vis) shown++;
      });
      document.querySelectorAll("section.block").forEach(function (b) {
        var any = Array.prototype.some.call(b.querySelectorAll("tbody tr"), function (tr) { return !tr.hidden; });
        b.hidden = !any;
      });
      stat.textContent = shown === rows.length ? "показаны все " + rows.length + " страниц" : "найдено " + shown + " из " + rows.length;
    }

    chips.forEach(function (c) {
      c.addEventListener("click", function () {
        var w = c.getAttribute("data-wave");
        activeWave = activeWave === w ? null : w;
        chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-wave") === activeWave)); });
        apply();
      });
    });
    q.addEventListener("input", apply);
    apply();
  })();
</script>
`;

fs.writeFileSync("seo-map.html", html, "utf8");
console.log("seo-map.html: " + (html.length / 1024).toFixed(1) + " КБ, страниц " + enriched.length + ", волны: " + waveCount(1) + "/" + waveCount(2) + "/" + waveCount(3));
