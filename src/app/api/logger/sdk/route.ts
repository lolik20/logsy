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

    var SLOW_MS = 500;       // порог «медленного» запроса
    var FLUSH_MS = 10000;    // интервал отправки батча
    var MAX_BODY = 2000;     // предел размера тела запроса
    var MAX_BUFFER = 50;     // предел числа событий в батче

    // Идентификатор пользовательской сессии (живёт в рамках вкладки).
    var sid;
    try {
      sid = sessionStorage.getItem("logsy_sid");
      if (!sid) {
        sid = (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
        sessionStorage.setItem("logsy_sid", sid);
      }
    } catch (e) { sid = Date.now().toString(36); }

    var ua = navigator.userAgent;
    var buffer = [];

    function clip(v) {
      if (v == null) return null;
      try { if (typeof v !== "string") v = JSON.stringify(v); } catch (e) { v = String(v); }
      return v.length > MAX_BODY ? v.slice(0, MAX_BODY) + "…" : v;
    }

    function push(ev) {
      ev.ts = Date.now();
      buffer.push(ev);
      if (buffer.length >= MAX_BUFFER) flush(false);
    }

    // Не логируем собственные запросы к ингесту (иначе — бесконечная петля).
    function isOwn(url) {
      try { return String(url).indexOf(ENDPOINT) === 0; } catch (e) { return false; }
    }

    function flush(useBeacon) {
      if (!buffer.length) return;
      var batch = { sessionKey: sid, userAgent: ua, events: buffer.splice(0, buffer.length) };
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
    function record(method, url, status, durationMs, reqBody, failed) {
      if (isOwn(url)) return;
      var slow = durationMs > SLOW_MS;
      var httpErr = status >= 400;
      if (!slow && !httpErr && !failed) return;
      push({
        type: failed ? "HTTP_ERROR" : (httpErr ? "HTTP_ERROR" : "SLOW_REQUEST"),
        message: failed ? "Network request failed" : (httpErr ? ("HTTP " + status) : ("Slow request " + durationMs + "ms")),
        route: String(url),
        method: method || "GET",
        statusCode: status || null,
        durationMs: durationMs,
        reqBody: clip(reqBody),
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
          try { record(method, url, res.status, Date.now() - start, reqBody, false); } catch (e) {}
          return res;
        }, function(err) {
          try { record(method, url, 0, Date.now() - start, reqBody, true); } catch (e) {}
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
            record(meta.method, meta.url, self.status, Date.now() - start, body, failed);
          } catch (e) {}
        });
        return _send.apply(this, arguments);
      };
    }

    // ---- Периодическая отправка и флаш при уходе со страницы ----
    setInterval(function(){ flush(false); }, FLUSH_MS);
    document.addEventListener("visibilitychange", function() {
      if (document.visibilityState === "hidden") flush(true);
    });
    window.addEventListener("pagehide", function(){ flush(true); });

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
