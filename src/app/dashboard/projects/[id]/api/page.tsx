import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getUserId, isAdmin } from "@/lib/session";
import { ensureProjectApiKey } from "@/lib/api-key";
import { retentionLabel } from "@/lib/logging";
import { ProjectHeader } from "@/components/ProjectHeader";
import { ApiKeyCard } from "@/components/ApiKeyCard";
import { CopyCodeBlock } from "@/components/CopyCodeBlock";

export const dynamic = "force-dynamic";

function appUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

/**
 * Вкладка «API» проекта: ключ доступа (выпускается автоматически, можно перевыпустить)
 * и краткая документация по двум методам публичного HTTP-API — список сессий и
 * подробности одной сессии со всеми её событиями.
 */
export default async function ApiPage({ params }: { params: { id: string } }) {
  const userId = (await getUserId())!;
  const admin = await isAdmin();

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project || (project.userId !== userId && !admin)) notFound();

  // Ключ выпускается лениво — при первом открытии вкладки он уже готов к копированию.
  const apiKey = await ensureProjectApiKey(project.id);

  const base = appUrl() || "https://<ваш-домен>";
  // В примерах вместо самого ключа — переменная окружения: страница не должна
  // раскрывать ключ в обход кнопки «Показать» в карточке выше.
  const keySample = "$LOGSY_API_KEY";

  return (
    <div>
      <ProjectHeader
        projectId={project.id}
        name={project.name}
        domain={project.domain}
        active="api"
      />

      <ApiKeyCard projectId={project.id} apiKey={apiKey} />

      {/* ---------------------------- Общее ---------------------------- */}
      <Section title="Как обращаться к API">
        <p className="text-sm text-slate-500">
          API читает данные сервиса логирования этого сайта. Все методы —{" "}
          <span className="font-mono">GET</span>, ответ всегда JSON в кодировке UTF-8.
          Базовый адрес:
        </p>
        <CopyCodeBlock code={`${base}/api/v1`} />
        <p className="mt-4 text-sm text-slate-500">
          Ключ передаётся в заголовке — любым из двух способов:
        </p>
        <CopyCodeBlock
          code={`Authorization: Bearer ${keySample}\n# или\nX-Api-Key: ${keySample}`}
        />
        <p className="mt-2 text-xs text-slate-400">
          В примерах ниже ключ подставляется из переменной окружения — скопируйте его
          кнопкой выше и задайте её у себя:{" "}
          <span className="font-mono">export LOGSY_API_KEY=&quot;ваш ключ&quot;</span>.
        </p>
        <p className="mt-4 text-xs text-slate-400">
          Запросы идут с вашего сервера: ключ открывает доступ ко всем логам сайта,
          поэтому в браузер его отдавать нельзя. Данные доступны в пределах срока
          хранения логов по тарифу — сейчас это {retentionLabel(project)}; всё, что
          старше, удаляется и через API тоже не вернётся.
        </p>
      </Section>

      {/* ------------------- Метод 1: список сессий ------------------- */}
      <Section title="1. Список сессий">
        <Endpoint method="GET" path="/api/v1/sessions" />
        <p className="mt-3 text-sm text-slate-500">
          Пользовательские сессии сайта, от самой свежей активности к старой. У каждой
          сессии — её посетитель (IP, страна, User-Agent, метки перехода) и счётчики
          событий. Ответ постраничный.
        </p>

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Параметры запроса
        </h4>
        <ParamTable
          rows={[
            ["date", "YYYY-MM-DD", "Сессии, начавшиеся в указанные сутки (UTC). Короткая замена пары from/to — если передан, перекрывает их."],
            ["from", "ISO-8601", "Начало периода по времени старта сессии, включительно. Напр. 2026-07-31T00:00:00Z."],
            ["to", "ISO-8601", "Конец периода по времени старта сессии, не включая границу."],
            ["limit", "1…200", "Сколько сессий вернуть. По умолчанию 50."],
            ["offset", "≥ 0", "Сколько сессий пропустить (постраничный обход). По умолчанию 0."],
          ]}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Пример запроса
        </h4>
        <CopyCodeBlock
          code={`curl -H "Authorization: Bearer ${keySample}" \\\n  "${base}/api/v1/sessions?date=2026-07-31&limit=50"`}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Пример ответа
        </h4>
        <CopyCodeBlock
          code={`{
  "project": { "id": "${project.id}", "name": "${project.name}", "domain": "${project.domain}" },
  "total": 128,
  "limit": 50,
  "offset": 0,
  "sessions": [
    {
      "id": "clx8f2k0a0001qw",
      "sessionKey": "s-1753948800-9f3a",
      "startedAt": "2026-07-31T09:14:02.331Z",
      "lastSeenAt": "2026-07-31T09:21:47.902Z",
      "ip": "203.0.113.17",
      "country": "RU",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)…",
      "utm": { "utm_source": "yandex", "utm_medium": "cpc" },
      "events": { "total": 42, "errors": 3, "slow": 5 }
    }
  ]
}`}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Поля сессии
        </h4>
        <ParamTable
          rows={[
            ["id", "string", "Внутренний идентификатор сессии — его передают во второй метод."],
            ["sessionKey", "string", "Идентификатор сессии, сгенерированный SDK в браузере посетителя."],
            ["startedAt / lastSeenAt", "ISO-8601", "Начало сессии и время последней активности."],
            ["ip", "string | null", "IP посетителя. Сессии одного посетителя в панели группируются по нему."],
            ["country", "string | null", "Код страны по IP (ISO-3166 alpha-2), напр. RU."],
            ["userAgent", "string | null", "User-Agent браузера посетителя."],
            ["utm", "object | null", "Метки перехода первого визита: utm_*, yclid, ysclid, gclid, fbclid, etext."],
            ["events", "object", "Счётчики: total — всего событий, errors — ошибок, slow — медленных запросов и ресурсов."],
          ]}
        />
      </Section>

      {/* --------------- Метод 2: подробности сессии --------------- */}
      <Section title="2. Подробности сессии со всеми событиями">
        <Endpoint method="GET" path="/api/v1/sessions/{id}" />
        <p className="mt-3 text-sm text-slate-500">
          Полная выгрузка одной сессии: её данные и <b>все события</b> в порядке
          возникновения — ошибки, запросы, переходы, клики, ввод, сообщения из обратной
          формы. Вместо <span className="font-mono">{"{id}"}</span> подойдёт и{" "}
          <span className="font-mono">id</span> из списка, и{" "}
          <span className="font-mono">sessionKey</span> с сайта.
        </p>

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Пример запроса
        </h4>
        <CopyCodeBlock
          code={`curl -H "Authorization: Bearer ${keySample}" \\\n  "${base}/api/v1/sessions/clx8f2k0a0001qw"`}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Пример ответа
        </h4>
        <CopyCodeBlock
          code={`{
  "project": { "id": "${project.id}", "name": "${project.name}", "domain": "${project.domain}" },
  "session": {
    "id": "clx8f2k0a0001qw",
    "sessionKey": "s-1753948800-9f3a",
    "startedAt": "2026-07-31T09:14:02.331Z",
    "lastSeenAt": "2026-07-31T09:21:47.902Z",
    "ip": "203.0.113.17",
    "country": "RU",
    "userAgent": "Mozilla/5.0 …",
    "utm": { "utm_source": "yandex" },
    "events": { "total": 42, "errors": 3, "slow": 5 },
    "recording": { "available": true, "chunks": 17 }
  },
  "events": [
    {
      "id": "clx8f2k0b0002qw",
      "type": "HTTP_ERROR",
      "createdAt": "2026-07-31T09:15:10.104Z",
      "message": "Request failed with status 500",
      "stack": null,
      "url": "https://${project.domain}/checkout",
      "route": "https://${project.domain}/api/order?promo=SALE",
      "query": "promo=SALE",
      "method": "POST",
      "statusCode": 500,
      "durationMs": 812,
      "reqBody": "{\\"items\\":[…]}",
      "resBody": "{\\"error\\":\\"internal\\"}",
      "meta": null
    }
  ]
}`}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Поля события
        </h4>
        <ParamTable
          rows={[
            ["id", "string", "Идентификатор события."],
            ["type", "string", "Тип события — см. таблицу ниже."],
            ["createdAt", "ISO-8601", "Когда событие произошло."],
            ["message", "string | null", "Текст ошибки, описание события или сообщение посетителя."],
            ["stack", "string | null", "Стек JS-ошибки, если он был."],
            ["url", "string | null", "Адрес страницы, на которой произошло событие."],
            ["route", "string | null", "Адрес сетевого запроса или ресурса (с query-строкой)."],
            ["query", "string | null", "Query-параметры запроса."],
            ["method", "string | null", "HTTP-метод запроса."],
            ["statusCode", "number | null", "Код ответа сервера."],
            ["durationMs", "number | null", "Длительность запроса или загрузки, мс."],
            ["reqBody / resBody", "string | null", "Тело запроса и ответа (усечены до 2000 символов)."],
            ["meta", "object | null", "Дополнительные данные. Для USER_REPORT здесь почта отправителя."],
          ]}
        />

        <h4 className="mt-5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          Типы событий
        </h4>
        <ParamTable
          head={["Тип", "Что означает"]}
          rows={[
            ["ERROR", "JS-ошибка на странице."],
            ["UNHANDLED_REJECTION", "Необработанный промис."],
            ["HTTP_ERROR", "Запрос завершился ошибочным кодом ответа."],
            ["SLOW_REQUEST", `Запрос дольше порога «медленного» (сейчас ${project.slowMs} мс).`],
            ["SLOW_RESOURCE", "Медленный статический файл: скрипт, стиль, картинка, шрифт."],
            ["PAGE_LOAD", "Замер времени до прогрузки контента страницы."],
            ["NAVIGATION", "Переход на другую страницу сайта (поддомены считаются своими)."],
            ["OUTBOUND", "Уход на другой сайт; полный адрес назначения — в поле route."],
            ["CLICK / INPUT", "Клик по элементу и ввод в поле (значения не сохраняются)."],
            ["RAGE_CLICK", "Серия быстрых кликов в одну точку — признак фрустрации."],
            ["USER_REPORT", "Сообщение из обратной формы ошибок; почта отправителя — в meta.email."],
            ["SESSION_START / SESSION_END", "Начало визита и уход со страницы."],
          ]}
        />
      </Section>

      {/* ---------------------------- Ошибки ---------------------------- */}
      <Section title="Коды ответов и ошибки">
        <p className="text-sm text-slate-500">
          При ошибке возвращается JSON вида{" "}
          <span className="font-mono">{`{ "error": "описание" }`}</span> с одним из кодов:
        </p>
        <ParamTable
          head={["Код", "Когда"]}
          rows={[
            ["200", "Успех."],
            ["401", "Ключ не передан, неверен или был перевыпущен."],
            ["404", "Сессия не найдена или принадлежит другому сайту."],
          ]}
        />
      </Section>
    </div>
  );
}

/** Карточка-раздел документации. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="mb-3 text-base font-semibold text-slate-800 dark:text-slate-100">
        {title}
      </h2>
      {children}
    </div>
  );
}

/** Строка «метод + путь» в заголовке описания эндпоинта. */
function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
      <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
        {method}
      </span>
      <span className="break-all font-mono text-sm text-slate-700 dark:text-slate-200">
        {path}
      </span>
    </div>
  );
}

/**
 * Таблица документации. Три колонки — «параметр — тип — описание» (параметры запроса,
 * поля ответа), две — «значение — описание» (типы событий, коды ответов). Первая
 * колонка всегда моноширинная: в ней имя поля, тип события или код.
 */
function ParamTable({
  rows,
  head = ["Параметр", "Тип", "Описание"],
}: {
  rows: string[][];
  head?: string[];
}) {
  const wide = head.length > 2;
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className={`w-full text-left text-sm ${wide ? "min-w-[520px]" : "min-w-[360px]"}`}>
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/60">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells) => (
            <tr
              key={cells[0]}
              className="border-t border-slate-100 align-top dark:border-slate-800"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
                {cells[0]}
              </td>
              {wide && (
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400">
                  {cells[1]}
                </td>
              )}
              <td className="px-3 py-2 text-slate-500">{cells[cells.length - 1]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
