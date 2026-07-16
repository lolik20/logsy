// Отдаёт клиентский SDK логирования как статичный JS-файл.
//
// Подключение максимально простое — один тег в <head>:
//   <script src="https://app.logsy.ru/api/logger/sdk" async></script>
//
// Скрипт идентичен для всех проектов (конфиг не нужен): endpoint берётся из origin
// самого скрипта, а проект на сервере определяется по Origin запроса. Поэтому ответ
// кэшируется на CDN. Никакого ключа в теге нет — авторизация по домену (Origin).

export const dynamic = "force-dynamic";

// IIFE клиентского агента. Пишется как строка, чтобы отдавать без сборки/бандла.
const SDK = `(function(){
  "use strict";
  try {
    if (window.__logsy_loaded) return;
    window.__logsy_loaded = true;

    // Endpoint ингеста — из origin собственного тега скрипта.
    var self = document.currentScript;
    var origin = (self && self.src) ? new URL(self.src, location.href).origin : location.origin;
    var ENDPOINT = origin + "/api/logger/ingest";

    // Наш эндпоинт определения публичного IP пользователя (без сторонних сервисов).
    var IP_URL = origin + "/api/logger/ip";
    var clientIp = null;
    // Оригинальный fetch — сохраняем до обёртки, чтобы IP-запрос не логировался.
    var _origFetch = window.fetch ? window.fetch.bind(window) : null;

    var SLOW_MS = 1000;      // порог «медленного» запроса (мс)
    var FLUSH_MS = 10000;    // интервал отправки батча

    // Форматирует длительность из мс в секунды для текста лога («1.24 с»).
    function secs(ms) { return (Math.round(ms) / 1000) + " с"; }
    var MAX_BODY = 2000;     // предел размера тела запроса
    var MAX_BUFFER = 50;     // предел числа событий в батче

    // Порог «медленного» запроса можно переопределить прямо на теге скрипта:
    //   <script src=".../api/logger/sdk" data-slow-ms="2000" async></script>
    // Так каждый сайт задаёт свой порог, а сам скрипт остаётся общим и кэшируемым.
    // slowFromAttr: порог задан явно атрибутом на теге — тогда настройка из панели его
    // НЕ переопределяет (атрибут = точечное переопределение на конкретной странице).
    var slowFromAttr = false;
    try {
      var slowAttr = (self && self.getAttribute) ? self.getAttribute("data-slow-ms") : null;
      if (slowAttr != null && slowAttr !== "") {
        var slowNum = parseInt(slowAttr, 10);
        if (!isNaN(slowNum) && slowNum >= 0) { SLOW_MS = slowNum; slowFromAttr = true; }
      }
    } catch (e) {}

    // Идентификатор пользователя: один на браузер (localStorage), поэтому все
    // события пользователя группируются в ОДНУ сессию — и между вкладками, и
    // между визитами. Если localStorage недоступен — откат на sessionStorage,
    // затем на временный id в памяти.
    var sid;
    try {
      sid = localStorage.getItem("logsy_uid");
      if (!sid) {
        sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        localStorage.setItem("logsy_uid", sid);
      }
    } catch (e) {
      try {
        sid = sessionStorage.getItem("logsy_uid");
        if (!sid) {
          sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
          sessionStorage.setItem("logsy_uid", sid);
        }
      } catch (e2) { sid = Date.now().toString(36); }
    }

    // Определяем публичный IP пользователя через сторонний сервис (не блокируя).
    try {
      if (_origFetch) {
        _origFetch(IP_URL)
          .then(function (r) { return r.json(); })
          .then(function (d) { if (d && d.ip) clientIp = String(d.ip); })
          .catch(function () {});
      }
    } catch (e) {}

    // Конфигурация проекта: включена ли обратная форма ошибок. SDK общий и кэшируется,
    // поэтому флаг берём из эндпоинта конфига (проект определяется по Origin). Если
    // включено — рисуем плавающую кнопку «Сообщить об ошибке».
    var CONFIG_URL = origin + "/api/logger/config";
    try {
      if (_origFetch) {
        _origFetch(CONFIG_URL, { credentials: "omit", mode: "cors" })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d) return;
            // Порог «медленного» из панели проекта — если на теге нет явного data-slow-ms.
            if (!slowFromAttr && typeof d.slowMs === "number" && d.slowMs >= 0) SLOW_MS = d.slowMs;
            if (d.feedback) { try { initFeedback(); } catch (e) {} }
          })
          .catch(function () {});
      }
    } catch (e) {}

    var ua = navigator.userAgent;
    var buffer = [];

    // Метки перехода (UTM + рекламные идентификаторы клика) из query-строки лендинга.
    // Считаем ОДИН раз при загрузке скрипта — это URL первого захода. При дальнейшей
    // SPA-навигации метки из адреса пропадают, но сессии на сервере они уже присвоены.
    // Сервер сам отфильтрует ключи по своему списку — здесь берём известный набор.
    var MARK_KEYS = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
                     "yclid","ysclid","gclid","fbclid","etext"];
    var marks = null;
    try {
      var mp = new URLSearchParams(location.search);
      for (var mi = 0; mi < MARK_KEYS.length; mi++) {
        var mv = mp.get(MARK_KEYS[mi]);
        if (mv) { (marks = marks || {})[MARK_KEYS[mi]] = String(mv).slice(0, 512); }
      }
    } catch (e) {}

    // Приводит тело запроса разных типов к строке (payload для логирования).
    function clip(v) {
      if (v == null) return null;
      try {
        if (typeof v === "string") {
          // как есть
        } else if (typeof URLSearchParams !== "undefined" && v instanceof URLSearchParams) {
          v = v.toString();
        } else if (typeof FormData !== "undefined" && v instanceof FormData) {
          var o = {};
          v.forEach(function (val, k) { o[k] = (typeof val === "string") ? val : "[file]"; });
          v = JSON.stringify(o);
        } else if ((typeof Blob !== "undefined" && v instanceof Blob) ||
                   (typeof ArrayBuffer !== "undefined" && v instanceof ArrayBuffer)) {
          v = "[binary]";
        } else {
          v = JSON.stringify(v);
        }
      } catch (e) {
        try { v = String(v); } catch (e2) { v = "[unserializable]"; }
      }
      if (typeof v !== "string") {
        try { v = String(v); } catch (e) { v = "[unserializable]"; }
      }
      return v.length > MAX_BODY ? v.slice(0, MAX_BODY) + "…" : v;
    }

    // Извлекает query-строку из URL запроса (без ведущего "?").
    function queryOf(url) {
      try {
        var u = new URL(url, location.href);
        return u.search ? u.search.slice(1) : null;
      } catch (e) {
        var i = String(url).indexOf("?");
        return i >= 0 ? String(url).slice(i + 1) : null;
      }
    }

    function push(ev) {
      ev.ts = Date.now();
      buffer.push(ev);
      if (buffer.length >= MAX_BUFFER) flush(false);
    }

    // Не логируем собственные служебные запросы Logsy (ингест, определение IP) —
    // иначе получим петлю или лишние события.
    function isOwn(url) {
      try { return String(url).indexOf(origin + "/api/logger/") === 0; }
      catch (e) { return false; }
    }

    function flush(useBeacon) {
      if (!buffer.length) return;
      var batch = { sessionKey: sid, userAgent: ua, ip: clientIp, utm: marks, events: buffer.splice(0, buffer.length) };
      var body = JSON.stringify(batch);
      try {
        // text/plain — чтобы запрос был CORS-simple и без preflight.
        if (useBeacon && navigator.sendBeacon) {
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
        } else {
          fetch(ENDPOINT, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: body,
            keepalive: true,
            credentials: "omit",
            mode: "cors"
          }).catch(function(){});
        }
      } catch (e) {}
    }

    // ---- Фронт-ошибки ----
    window.addEventListener("error", function(e) {
      push({
        type: "ERROR",
        message: (e && e.message) ? String(e.message) : "Error",
        stack: (e && e.error && e.error.stack) ? String(e.error.stack) : null,
        url: location.href
      });
    });
    window.addEventListener("unhandledrejection", function(e) {
      var r = e && e.reason;
      push({
        type: "UNHANDLED_REJECTION",
        message: r ? String(r.message || r) : "Unhandled rejection",
        stack: (r && r.stack) ? String(r.stack) : null,
        url: location.href
      });
    });

    // Решает, надо ли отправить сетевое событие: ошибка бэкенда (>=400) или медленный (> SLOW_MS).
    // resBody — тело ответа сервера (только для ошибок), чтобы в логе был не просто код,
    // а реальный текст ответа бэкенда.
    function record(method, url, status, durationMs, reqBody, failed, resBody) {
      if (isOwn(url)) return;
      var slow = durationMs > SLOW_MS;
      var httpErr = status >= 400;
      if (!slow && !httpErr && !failed) return;
      push({
        type: failed ? "HTTP_ERROR" : (httpErr ? "HTTP_ERROR" : "SLOW_REQUEST"),
        message: failed ? "Network request failed" : (httpErr ? ("HTTP " + status) : ("Slow request " + secs(durationMs))),
        route: String(url),
        query: queryOf(url),
        method: method || "GET",
        statusCode: status || null,
        durationMs: durationMs,
        reqBody: clip(reqBody),
        resBody: clip(resBody),
        url: location.href
      });
    }

    // ---- Обёртка fetch ----
    var _fetch = window.fetch;
    if (_fetch) {
      window.fetch = function(input, init) {
        var start = Date.now();
        // input может быть строкой, Request (.url) или URL (.href) — иначе route окажется
        // пустым и медленный запрос покажется «без деталей» и без адреса.
        var url = (typeof input === "string")
          ? input
          : (input && (input.url || input.href)) || (input ? String(input) : "");
        var method = (init && init.method) || (input && input.method) || "GET";
        var reqBody = init && init.body ? init.body : null;
        return _fetch.apply(this, arguments).then(function(res) {
          var dur = Date.now() - start;
          try {
            // Для ошибок бэкенда читаем тело ответа. Клонируем ответ, чтобы не «съесть»
            // поток у приложения; чтение асинхронное, поэтому событие пушим в колбэке.
            if (res.status >= 400 && res.clone) {
              res.clone().text().then(function(body) {
                try { record(method, url, res.status, dur, reqBody, false, body); } catch (e) {}
              }, function() {
                try { record(method, url, res.status, dur, reqBody, false, null); } catch (e) {}
              });
            } else {
              record(method, url, res.status, dur, reqBody, false, null);
            }
          } catch (e) {}
          return res;
        }, function(err) {
          try { record(method, url, 0, Date.now() - start, reqBody, true, null); } catch (e) {}
          throw err;
        });
      };
    }

    // ---- Обёртка XMLHttpRequest ----
    var XP = XMLHttpRequest && XMLHttpRequest.prototype;
    if (XP) {
      var _open = XP.open, _send = XP.send;
      XP.open = function(method, url) {
        this.__logsy = { method: method, url: url };
        return _open.apply(this, arguments);
      };
      XP.send = function(body) {
        var self = this;
        var meta = self.__logsy || {};
        var start = Date.now();
        self.addEventListener("loadend", function() {
          try {
            var failed = self.status === 0;
            // Тело ответа доступно как строка только для text/'' responseType.
            var resBody = null;
            if (self.status >= 400) {
              try {
                if (self.responseType === "" || self.responseType === "text") {
                  resBody = self.responseText;
                }
              } catch (e) {}
            }
            record(meta.method, meta.url, self.status, Date.now() - start, body, failed, resBody);
          } catch (e) {}
        });
        return _send.apply(this, arguments);
      };
    }

    // ---- Пользовательские события: начало сессии, клики, ввод, навигация ----

    // Короткое описание DOM-элемента: <тег>#id «текст/подпись». Используется в
    // сообщениях о кликах и вводе, чтобы в логе было видно, по чему кликнули.
    function elDesc(el) {
      try {
        if (!el || el.nodeType !== 1) return "";
        var tag = el.tagName ? el.tagName.toLowerCase() : "?";
        var id = el.id ? "#" + el.id : "";
        var label = "";
        var txt = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim();
        if (txt) {
          label = txt.slice(0, 60);
        } else if (el.getAttribute) {
          label = el.getAttribute("aria-label") || el.getAttribute("title") ||
                  el.getAttribute("name") || el.getAttribute("placeholder") || "";
        }
        // Фолбэк для «обезличенных» элементов (кнопка с одной иконкой, пустой div
        // и т.п.): текста и подписей нет — берём первые 10 символов внутренней
        // разметки, чтобы в логе было хоть какое-то содержимое, а не голый <тег>.
        if (!label) {
          var html = (el.innerHTML || "").replace(/\\s+/g, " ").trim();
          if (html) label = html.slice(0, 10);
        }
        return "<" + tag + ">" + id + (label ? " «" + label + "»" : "");
      } catch (e) { return ""; }
    }

    // Начало сессии — один раз на вкладку/визит (флаг в sessionStorage переживает
    // переходы между страницами внутри вкладки, но не новый визит).
    var freshSession = false;
    try {
      if (!sessionStorage.getItem("logsy_started")) {
        sessionStorage.setItem("logsy_started", "1");
        freshSession = true;
      }
    } catch (e) { freshSession = true; }
    if (freshSession) {
      push({
        type: "SESSION_START",
        message: "Начало сессии" + (document.referrer ? " · источник: " + document.referrer : ""),
        url: location.href
      });
    }

    // Первый просмотр страницы — как переход. Далее ловим SPA-навигацию.
    var lastUrl = location.href;
    push({ type: "NAVIGATION", message: "Открыта страница: " + location.pathname, url: location.href });

    function logNav() {
      var u = location.href;
      if (u === lastUrl) return;
      lastUrl = u;
      push({ type: "NAVIGATION", message: "Переход: " + location.pathname + location.search, url: u });
    }
    try {
      var _ps = history.pushState, _rs = history.replaceState;
      if (_ps) history.pushState = function() { var r = _ps.apply(this, arguments); try { logNav(); } catch (e) {} return r; };
      if (_rs) history.replaceState = function() { var r = _rs.apply(this, arguments); try { logNav(); } catch (e) {} return r; };
      window.addEventListener("popstate", function() { try { logNav(); } catch (e) {} });
      window.addEventListener("hashchange", function() { try { logNav(); } catch (e) {} });
    } catch (e) {}

    // ---- Карта загрузки: время до прогрузки конечного контента ----
    // На каждую «жёсткую» загрузку страницы фиксируем PAGE_LOAD с длительностью до
    // полной загрузки (Navigation Timing loadEventEnd — момент, когда конечный контент
    // и ресурсы страницы прогрузились). SPA-переходы сюда не попадают (у них нет отдельной
    // navigation-записи) — это ожидаемо, карта строится по реальным заходам на страницы.
    var _pageLoadSent = false;
    function reportPageLoad() {
      if (_pageLoadSent) return;
      try {
        var loadMs = 0, dclMs = 0;
        if (performance && performance.getEntriesByType) {
          var navs = performance.getEntriesByType("navigation");
          var nav = navs && navs[0];
          if (nav) {
            loadMs = Math.round(nav.loadEventEnd || nav.domComplete || 0);
            dclMs = Math.round(nav.domContentLoadedEventEnd || 0);
          }
        }
        // Фолбэк для старых браузеров без Navigation Timing L2.
        if (!loadMs && performance && performance.timing) {
          var t = performance.timing;
          if (t.loadEventEnd && t.navigationStart) loadMs = t.loadEventEnd - t.navigationStart;
        }
        if (!loadMs && performance && performance.now) loadMs = Math.round(performance.now());
        if (loadMs > 0) {
          _pageLoadSent = true;
          push({
            type: "PAGE_LOAD",
            message: "Загрузка страницы: " + secs(loadMs) + (dclMs ? " (DOM " + secs(dclMs) + ")" : ""),
            url: location.href,
            durationMs: loadMs
          });
        }
      } catch (e) {}
    }
    if (document.readyState === "complete") setTimeout(reportPageLoad, 0);
    else window.addEventListener("load", function () { setTimeout(reportPageLoad, 0); });

    // ---- Карта загрузки: медленные статические файлы (> SLOW_MS) ----
    // Через Resource Timing ловим ресурсы страницы (скрипты, стили, картинки, шрифты),
    // которые грузились дольше порога. Сетевые запросы приложения (fetch/xhr/beacon)
    // сюда не берём — они уже покрыты обёртками fetch/XHR как SLOW_REQUEST/HTTP_ERROR.
    try {
      if (window.PerformanceObserver) {
        var _resObs = new PerformanceObserver(function (list) {
          var ents = list.getEntries();
          for (var ri = 0; ri < ents.length; ri++) {
            try {
              var en = ents[ri];
              var it = en.initiatorType || "";
              if (it === "fetch" || it === "xmlhttprequest" || it === "beacon") continue;
              var dur = Math.round(en.duration || 0);
              if (dur <= SLOW_MS) continue;
              if (isOwn(en.name)) continue;
              // Предзагруженные (<link rel=preload/prefetch>) картинки/шрифты браузер
              // помечает обобщённым «link» — по расширению определяем реальный тип (img/font),
              // иначе они отображаются как «link» вместо png/webp.
              var sub = it;
              if (it === "link" || it === "other" || it === "") {
                var path = String(en.name).split("?")[0].split("#")[0];
                if (/\.(png|jpe?g|gif|svg|webp|avif|ico|bmp)$/i.test(path)) sub = "img";
                else if (/\.(woff2?|ttf|otf|eot)$/i.test(path)) sub = "font";
                else if (/\.(js|mjs|cjs)$/i.test(path)) sub = "script";
                else if (/\.css$/i.test(path)) sub = "css";
              }
              push({
                type: "SLOW_RESOURCE",
                message: "Медленный ресурс (" + (sub || "?") + "): " + secs(dur),
                route: String(en.name),
                method: sub ? String(sub).slice(0, 16) : null,
                durationMs: dur,
                url: location.href
              });
            } catch (e) {}
          }
        });
        _resObs.observe({ type: "resource", buffered: true });
      }
    } catch (e) {}

    // Клики (в т.ч. по кнопкам/ссылкам). Ищем ближайший осмысленный элемент —
    // кнопку/ссылку/роль button, иначе сам таргет.
    document.addEventListener("click", function(e) {
      try {
        var t = e.target;
        var el = (t && t.closest)
          ? (t.closest("button, a, [role=button], input[type=submit], input[type=button], label, [onclick]") || t)
          : t;
        push({ type: "CLICK", message: "Клик: " + (elDesc(el) || "элемент"), url: location.href });
      } catch (err) {}
    }, true);

    // Ввод в поля. По событию change (значение зафиксировано на blur) — без шума
    // на каждое нажатие клавиши. Пароли не логируем.
    document.addEventListener("change", function(e) {
      try {
        var el = e.target;
        if (!el || !el.tagName) return;
        var tag = el.tagName.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && tag !== "select") return;
        var type = (el.type || "").toLowerCase();
        var name = el.name || el.id || (el.getAttribute && el.getAttribute("placeholder")) || type || tag;
        var val;
        if (type === "password") val = "[скрыто]";
        else if (type === "checkbox" || type === "radio") val = el.checked ? "✓ вкл" : "✗ выкл";
        else val = String(el.value == null ? "" : el.value).slice(0, 100);
        push({ type: "INPUT", message: "Ввод: " + name + " = " + val, url: location.href });
      } catch (err) {}
    }, true);

    // ---- Периодическая отправка и флаш при уходе со страницы ----
    // Перед выходом с сайта фиксируем отказ в сессии (SESSION_END) — один раз, затем
    // отправляем накопленный батч beacon'ом, чтобы событие точно ушло при закрытии.
    var _left = false;
    function leave() {
      if (_left) return;
      _left = true;
      push({ type: "SESSION_END", message: "Выход с сайта: " + location.pathname, url: location.href });
      flush(true);
    }
    setInterval(function(){ flush(false); }, FLUSH_MS);
    // Скрытие вкладки (переключение) — только флашим накопленное, без отметки об уходе.
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") flush(true);
    });
    // Реальный уход со страницы (закрытие/навигация прочь) — фиксируем отказ в сессии.
    window.addEventListener("pagehide", leave);

    // ---- Обратная форма ошибок (кнопка «Сообщить об ошибке») ----
    // Рисуется только если проект включил опцию (см. запрос конфига выше). Плавающая
    // кнопка в правом нижнем углу (ПК и мобилка) открывает мини-форму с текстовым полем.
    // Отправка кладёт событие USER_REPORT в буфер и сразу флашит — сообщение появляется
    // в сессии пользователя в логировании. Вся разметка живёт в Shadow DOM, чтобы стили
    // сайта клиента её не задели (и наоборот).
    var feedbackReady = false;
    function initFeedback() {
      if (feedbackReady) return;
      feedbackReady = true;
      if (!document.body) {
        // DOM ещё не готов — дождёмся.
        window.addEventListener("DOMContentLoaded", function () { feedbackReady = false; initFeedback(); });
        return;
      }

      var host = document.createElement("div");
      host.setAttribute("data-logsy-feedback", "");
      var root = host.attachShadow ? host.attachShadow({ mode: "open" }) : host;

      var css = ""
        + ":host,*{box-sizing:border-box;}"
        + ".wrap{position:fixed;right:20px;bottom:20px;z-index:2147483000;"
        + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;}"
        + ".fab{display:flex;align-items:center;gap:8px;border:0;cursor:pointer;"
        + "background:#4f46e5;color:#fff;border-radius:9999px;padding:12px 16px;"
        + "font-size:14px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,.25);}"
        + ".fab:hover{background:#4338ca;}"
        + ".fab svg{width:18px;height:18px;}"
        + ".fab .lbl{white-space:nowrap;}"
        + "@media (max-width:640px){.fab{padding:12px;} .fab .lbl{display:none;}}"
        + ".panel{position:absolute;right:0;bottom:60px;width:300px;max-width:calc(100vw - 40px);"
        + "background:#fff;color:#0f172a;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);"
        + "padding:16px;display:none;}"
        + ".panel.open{display:block;}"
        + ".close{position:absolute;top:10px;right:10px;width:26px;height:26px;display:flex;"
        + "align-items:center;justify-content:center;padding:0;border:0;background:transparent;"
        + "color:#94a3b8;cursor:pointer;border-radius:8px;}"
        + ".close:hover{background:#f1f5f9;color:#334155;}"
        + ".close svg{width:16px;height:16px;}"
        + ".ttl{font-size:15px;font-weight:700;margin:0 24px 4px 0;}"
        + ".sub{font-size:12px;color:#64748b;margin:0 0 10px;}"
        + "input.email{width:100%;border:1px solid #cbd5e1;border-radius:10px;"
        + "padding:8px 10px;font-size:13px;font-family:inherit;color:#0f172a;"
        + "background:#fff;outline:none;margin-bottom:8px;}"
        + "input.email:focus{border-color:#4f46e5;box-shadow:0 0 0 2px rgba(79,70,229,.2);}"
        + "input.email.err,textarea.err{border-color:#dc2626;box-shadow:0 0 0 2px rgba(220,38,38,.2);}"
        + ".field-err{font-size:12px;color:#dc2626;margin:2px 0 6px;}"
        + "textarea{width:100%;min-height:88px;resize:vertical;border:1px solid #cbd5e1;"
        + "border-radius:10px;padding:8px 10px;font-size:13px;font-family:inherit;color:#0f172a;"
        + "background:#fff;outline:none;}"
        + "textarea:focus{border-color:#4f46e5;box-shadow:0 0 0 2px rgba(79,70,229,.2);}"
        + ".row{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:10px;}"
        + "button.act{border:0;cursor:pointer;border-radius:9999px;padding:8px 14px;font-size:13px;font-weight:600;}"
        + ".send{background:#4f46e5;color:#fff;}"
        + ".send:hover{background:#4338ca;}"
        + ".send:disabled{opacity:.6;cursor:default;}"
        + ".ok{font-size:13px;color:#059669;text-align:center;padding:8px 0;}"
        + ".powered{font-size:11px;color:#94a3b8;text-decoration:none;}"
        + ".powered:hover{color:#4f46e5;text-decoration:underline;}"
        + ".foot{margin-top:10px;text-align:center;}"
        + ".foot a{font-size:11px;color:#94a3b8;text-decoration:none;}"
        + ".foot a:hover{color:#4f46e5;text-decoration:underline;}";

      var wrap = document.createElement("div");
      wrap.className = "wrap";
      wrap.innerHTML =
        '<div class="panel" role="dialog" aria-label="Сообщить об ошибке">'
        + '<button type="button" class="close" aria-label="Закрыть">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>'
        + '<p class="ttl">Сообщить об ошибке</p>'
        + '<p class="sub">Опишите, что пошло не так — мы это увидим.</p>'
        + '<input class="email" type="email" inputmode="email" autocomplete="email" maxlength="320" placeholder="Ваша почта для связи" />'
        + '<div class="field-err email-err" style="display:none">Введите корректную почту</div>'
        + '<textarea maxlength="1000" placeholder="Что случилось?"></textarea>'
        + '<div class="field-err text-err" style="display:none">Опишите проблему</div>'
        + '<div class="row">'
        + '<a class="powered" href="' + origin + '" target="_blank" rel="noopener noreferrer">Работает на Logsy</a>'
        + '<button type="button" class="act send">Отправить</button>'
        + '</div>'
        + '</div>'
        + '<button type="button" class="fab" aria-label="Сообщить об ошибке">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
        + '<span class="lbl">Сообщить об ошибке</span></button>';

      var style = document.createElement("style");
      style.textContent = css;
      root.appendChild(style);
      root.appendChild(wrap);
      document.body.appendChild(host);

      var panel = wrap.querySelector(".panel");
      var fab = wrap.querySelector(".fab");
      var emailInput = wrap.querySelector("input.email");
      var emailErr = wrap.querySelector(".email-err");
      var ta = wrap.querySelector("textarea");
      var textErr = wrap.querySelector(".text-err");
      var sendBtn = wrap.querySelector(".send");
      var closeBtn = wrap.querySelector(".close");

      // Простая проверка формата почты (та же логика и на сервере).
      var EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
      function validEmail(v) { return EMAIL_RE.test(v); }

      function openPanel() { panel.classList.add("open"); try { emailInput.focus(); } catch (e) {} }
      function closePanel() { panel.classList.remove("open"); }

      // Скрываем ошибку поля, как только пользователь начал его править.
      emailInput.addEventListener("input", function () {
        emailInput.classList.remove("err"); emailErr.style.display = "none";
      });
      ta.addEventListener("input", function () {
        ta.classList.remove("err"); textErr.style.display = "none";
      });

      fab.addEventListener("click", function () {
        if (panel.classList.contains("open")) closePanel(); else openPanel();
      });
      closeBtn.addEventListener("click", closePanel);

      sendBtn.addEventListener("click", function () {
        var email = (emailInput.value || "").trim();
        var text = (ta.value || "").trim();
        var bad = false;
        // Почта обязательна и должна быть корректной.
        if (!validEmail(email)) {
          emailInput.classList.add("err"); emailErr.style.display = "block"; bad = true;
        }
        if (!text) {
          ta.classList.add("err"); textErr.style.display = "block"; bad = true;
        }
        if (bad) {
          try { (!validEmail(email) ? emailInput : ta).focus(); } catch (e) {}
          return;
        }
        push({ type: "USER_REPORT", message: text.slice(0, 1000), email: email.slice(0, 320), url: location.href });
        flush(false);
        ta.value = "";
        emailInput.value = "";
        // Показываем благодарность и закрываем форму.
        panel.innerHTML = '<div class="ok">Спасибо! Сообщение отправлено.</div>'
          + '<div class="foot"><a href="' + origin + '" target="_blank" rel="noopener noreferrer">Работает на Logsy</a></div>';
        setTimeout(closePanel, 1500);
      });
    }

    // Seam под запись экрана — реализуем позже.
    window.LOGSY = { _rec: null, flush: function(){ flush(false); } };
  } catch (e) { /* SDK не должен ломать сайт клиента */ }
})();`;

export async function GET() {
  return new Response(SDK, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
