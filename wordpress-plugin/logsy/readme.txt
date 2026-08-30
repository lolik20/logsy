=== Logsy – Uptime Monitoring, Error Logging, Session Replay & 152-FZ ===
Contributors: logsy
Tags: monitoring, uptime, error logging, session replay, 152-fz
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Uptime monitoring, JavaScript error logging, session replay and 152-FZ compliance for Russian sites: privacy policy, consent checkbox, consent log.

== Description ==

Logsy is a monitoring and logging service made for websites that serve Russian audiences. This plugin connects your WordPress site to Logsy with a single switch — no code editing, no API keys.

What you get in the Logsy dashboard:

* **Uptime monitoring** — your site is checked every minute from servers in Russia; alerts go to email and Telegram.
* **JavaScript error logging** — frontend exceptions with stack traces, failed and slow network requests with payloads.
* **Session replay** — watch a visitor's session like a video to reproduce bugs and complaints; form inputs are masked by default.
* **152-FZ consent tools** — generated privacy policy, public offer and consent text hosted on a permanent URL, a consent checkbox for your forms, and a consent log that records page, form, document version, time and IP.
* **Site audit** — a real browser crawls your pages and reports backend errors, slow requests, broken forms and 152-FZ compliance gaps.

The free plan is free forever. A paid plan raises limits.

**How it works.** The plugin embeds the Logsy SDK script on your public pages. There is no API key: your Logsy project is matched by your site's domain. Until you enable the switch in *Settings → Logsy*, the plugin makes no external requests and collects nothing.

The service and its dashboard are in Russian. Data is stored on servers located in Russia, which matters for operators of personal data under Federal Law 152-FZ.

== Описание на русском ==

Logsy — российский сервис мониторинга сайта. Плагин подключает его одним переключателем, без правки кода и без API-ключей. Что вы получаете:

* **Мониторинг доступности сайта** — проверка раз в минуту с серверов в России, уведомления о падении на почту и в Telegram.
* **Логирование ошибок JavaScript** — ошибки фронтенда со стектрейсом, упавшие и медленные запросы с телом и заголовками.
* **Запись сессий пользователей** — смотрите действия посетителя как видео и воспроизводите баги; поля форм маскируются.
* **Проверка сайта на 152-ФЗ** — политика, галочки в формах, счётчики до согласия, реквизиты оператора.
* **Документы по 152-ФЗ** — генератор политики конфиденциальности, оферты и текста согласия на обработку персональных данных по вашим реквизитам, с постоянной ссылкой.
* **Галочка согласия и журнал согласий** — чекбокс в формах сайта и запись каждого согласия: страница, версия документа, время, IP.
* **Баннер cookie** — уведомление и согласие на cookie по закону.

Данные хранятся в России. Бесплатный тариф — навсегда, платные тарифы расширяют лимиты.

== External Services ==

When (and only when) the site owner enables the plugin in *Settings → Logsy*, the plugin embeds the Logsy SDK script from `https://logsy.ru/api/logger/sdk` on public pages of the site.

The script sends technical data about visitor sessions to Logsy (logsy.ru) servers: JavaScript errors, network request metadata (including failed request payloads), page views, browser and device information, and the visitor's IP address. If the corresponding features are enabled in the site owner's Logsy project, it also sends session recordings (with form inputs masked) and consent-checkbox events for the 152-FZ consent log.

This data is sent so that the site owner can monitor errors, replay problem sessions and keep legally required consent records. Logsy servers are located in Russia.

Service provider: Logsy — https://logsy.ru
Terms of service: https://logsy.ru/offer
Privacy policy: https://logsy.ru/privacy

While the plugin's switch is off (the default after installation), no requests are made to any external service.

== Frequently Asked Questions ==

= Is Logsy free? =

There is a free plan with no time limit. Paid plans raise the limits on checks, log volume and stored sessions.

= Do I need an account or an API key? =

You need a free Logsy account with a project created for your site's domain. No API key is required: the script identifies your project by the domain it runs on.

= What data does the plugin itself store in WordPress? =

Only its own settings (two switches) in one option. Visitor data is processed by the Logsy service, not stored in your WordPress database. Uninstalling the plugin removes the option.

= Does it slow the site down? =

The SDK is a single script loaded asynchronously from a cached endpoint; it does not block page rendering.

= Does it work with caching plugins and page builders? =

Yes. The script is added through the standard WordPress enqueue system on all public pages and does not depend on the theme or builder.

= Is this GDPR/152-FZ compliant? =

The plugin gives you the tools: consent checkbox, hosted policy documents and a consent log. Compliance also depends on how you configure your site and documents. Session recordings mask form inputs by default.

== Changelog ==

= 1.0.0 =
* Initial release: embeds the Logsy SDK on public pages with a master switch and an option to exclude logged-in administrators.
