# WP-плагин Logsy — заметки по выпуску

Каталог `logsy/` — это готовый к упаковке плагин для каталога WordPress.org.
Плагин — тонкий коннектор («serviceware», guideline 6): до включения тумблера
в настройках не делает ни одного внешнего запроса (guideline 7), SDK подключает
через штатный enqueue с `strategy: async`, ключей не хранит — проект Logsy
определяется по домену сайта (Origin).

## Упаковка

Только настоящим Info-ZIP (в Git Bash на Windows `zip` нет, а `tar -a -cf x.zip`
молча собирает TAR с расширением .zip — uploader wordpress.org его не распакует
и скажет «У плагина нет названия»). Собирать на сервере:

```bash
scp -r wordpress-plugin/logsy root@46.8.29.168:/tmp/pack/
ssh root@46.8.29.168 'cd /tmp/pack && zip -qr logsy.zip logsy'
scp root@46.8.29.168:/tmp/pack/logsy.zip wordpress-plugin/logsy.zip
file wordpress-plugin/logsy.zip   # обязано сказать «Zip archive data»
```

В zip не должно попасть ничего, кроме `logsy/` (logsy.php, readme.txt,
uninstall.php, languages/).

## Перед сабмитом на wordpress.org

1. Прогнать официальный Plugin Check (плагин `plugin-check` из каталога) на
   тестовом WP ≥ 6.3 — ревью-команда гоняет его первым делом.
2. Проверить, что слаг `logsy` свободен: https://wordpress.org/plugins/logsy/
   (если занят — сабмитить как `logsy-monitoring`, слаг фиксируется навсегда).
3. Аккаунт на wordpress.org + сабмит: https://wordpress.org/plugins/developers/add/
   Ревью вручную, от нескольких дней до пары недель; отвечать на письма
   plugins@wordpress.org быстро — тред закрывают за неактивность.
4. После одобрения дадут SVN-репозиторий: код кладётся в `trunk/`, релиз — тег
   в `tags/1.0.0/`, скриншоты и баннеры — в `assets/` (не в zip плагина):
   - icon-256x256.png, banner-1544x500.png, screenshot-1.png (страница настроек).
5. Русский перевод — через translate.wordpress.org (GlotPress) после одобрения;
   в коде всё обёрнуто в `__()` с text domain `logsy`.

## Что проверить руками после установки

- До включения тумблера: во фронтенде нет запросов к logsy.ru (вкладка Network).
- После включения: `<script src="https://logsy.ru/api/logger/sdk" async>` в head,
  сессии появляются в панели проекта с доменом сайта.
- «Не загружать для администраторов» — скрипта нет у залогиненного админа.
- Деактивация/удаление: опция `logsy_settings` удалена (uninstall.php).

## Если ревьюер спросит про внешний скрипт (заготовка ответа)

> The plugin is a serviceware connector (guideline 6) to our monitoring service.
> The only external resource is the service's own frontend SDK, loaded over HTTPS
> from the documented service endpoint — the same pattern as Akismet, Site Kit or
> Microsoft Clarity connectors, covered by the guideline 8 exception for documented
> services. The plugin never downloads or executes server-side code from external
> sources, has no self-update mechanism, and makes zero external requests until the
> site owner explicitly enables the switch in settings. All data flows are disclosed
> in the readme's External Services section with links to the terms and privacy policy.

По трём запретным категориям со страницы сабмита: произвольный код пользователь
вставлять не может (тег зашит в код); внешний скрипт — исключение для
задокументированных сервисов; «дубликат без отличий» — комплект 152-ФЗ
(проверка, документы, журнал согласий) в каталоге не представлен вовсе.

## Тонкости ревью

- В readme.txt секция External Services обязательна (есть) — при правках SDK
  (новые типы данных) обновлять её синхронно.
- «Tested up to» держать актуальным под текущий мажор WP, иначе каталог
  помечает плагин как устаревший.
- Сервисные плагины с записью сессий смотрят внимательнее: не убирать из
  описания фразу про маскирование полей форм.
