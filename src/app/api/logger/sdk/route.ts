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

    var SLOW_MS = 500;       // порог «медленного» запроса
    var FLUSH_MS = 10000;    // интервал отправки батча
    var MAX_BODY = 2000;     // предел размера тела запроса
    var MAX_BUFFER = 50;     // предел числа событий в батче

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

    // Решает, надо ли отправить сетевое событие: ошибка бэкенда (>=400) или медленный (>500мс).
    // resBody — тело ответа сервера (только для ошибок), чтобы в логе был не просто код,
    // а реальный текст ответа бэкенда.
    function record(method, url, status, durationMs, reqBody, failed, resBody) {
      if (isOwn(url)) return;
      var slow = durationMs > SLOW_MS;
      var httpErr = status >= 400;
      if (!slow && !httpErr && !failed) return;
      push({
        type: failed ? "HTTP_ERROR" : (httpErr ? "HTTP_ERROR" : "SLOW_REQUEST"),
        message: failed ? "Network request failed" : (httpErr ? ("HTTP " + status) : ("Slow request " + durationMs + "ms")),
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
        var url = (typeof input === "string") ? input : (input && input.url) || "";
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
