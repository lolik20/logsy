// Проверка срока регистрации домена через RDAP — современную (HTTP/JSON) замену
// протокола WHOIS. Запрос идёт на публичный редиректор rdap.org, который
// перенаправляет на RDAP-сервер нужного реестра; ответ содержит массив events,
// откуда берём дату окончания регистрации (eventAction = "expiration").

/** Порог (в днях), начиная с которого регистрацию считаем «скоро истекающей». */
export const DOMAIN_WARN_DAYS = 30;

export interface DomainInfo {
  /** Удалось ли получить данные о регистрации. */
  ok: boolean;
  /** Дата окончания срока регистрации домена. */
  expiresAt: Date | null;
  /** Сколько полных дней осталось до окончания (может быть отрицательным). */
  daysLeft: number | null;
  /** Регистратор домена (по данным RDAP). */
  registrar: string | null;
  /** Текст ошибки, если данные получить не удалось. */
  error: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Форма RDAP-ответа, которая нам интересна (частичная — берём только нужное).
interface RdapEvent {
  eventAction?: string;
  eventDate?: string;
}
interface RdapEntity {
  roles?: string[];
  vcardArray?: unknown;
}
interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
}

/** Извлекает eTLD-домен второго уровня из хоста (example.com из www.example.com). */
export function registrableDomain(hostOrUrl: string): string | null {
  let host = hostOrUrl.trim();
  // Если передали URL — вытащим hostname.
  if (host.includes("://")) {
    try {
      host = new URL(host).hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^\/+/, "").replace(/\/.*$/, "").replace(/:.*/, "").toLowerCase();
  if (!host) return null;
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  // RDAP регистрируется на уровне домена реестра — берём последние две метки.
  // Этого достаточно для распространённых TLD (.ru, .com, .net, .org, .io).
  return labels.slice(-2).join(".");
}

/** Достаёт имя регистратора из vcardArray сущности RDAP. */
function registrarName(entities: RdapEntity[] | undefined): string | null {
  if (!entities) return null;
  const reg = entities.find((e) => e.roles?.includes("registrar"));
  if (!reg || !Array.isArray(reg.vcardArray)) return null;
  // vcardArray = ["vcard", [ ["version",{},"text","4.0"], ["fn",{},"text","Имя"], ... ]]
  const props = reg.vcardArray[1];
  if (!Array.isArray(props)) return null;
  for (const p of props) {
    if (Array.isArray(p) && p[0] === "fn" && typeof p[3] === "string") {
      return p[3];
    }
  }
  return null;
}

/**
 * Запрашивает у RDAP срок регистрации домена. Хост приводится к
 * регистрируемому домену (второй уровень). Следуем редиректам rdap.org до
 * RDAP-сервера реестра.
 */
export async function checkDomainRegistration(
  hostOrUrl: string,
  timeoutMs = 10000,
): Promise<DomainInfo> {
  const fail = (error: string): DomainInfo => ({
    ok: false,
    expiresAt: null,
    daysLeft: null,
    registrar: null,
    error,
  });

  const domain = registrableDomain(hostOrUrl);
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

    const data = (await res.json()) as RdapResponse;
    const expEvent = data.events?.find((e) => e.eventAction === "expiration");
    if (!expEvent?.eventDate) {
      return fail("Реестр не сообщил дату окончания регистрации");
    }
    const expiresAt = new Date(expEvent.eventDate);
    if (Number.isNaN(expiresAt.getTime())) {
      return fail("Не удалось разобрать дату окончания регистрации");
    }
    const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / DAY_MS);
    return {
      ok: true,
      expiresAt,
      daysLeft,
      registrar: registrarName(data.entities),
      error: null,
    };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return fail(`Таймаут RDAP-запроса (${timeoutMs} мс)`);
    }
    return fail(err instanceof Error ? err.message : "Ошибка RDAP-запроса");
  } finally {
    clearTimeout(timer);
  }
}

/** Выводит статус регистрации домена из числа оставшихся дней. */
export function domainStatusFromDays(ok: boolean, daysLeft: number | null): string {
  if (!ok || daysLeft === null) return "ERROR";
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= DOMAIN_WARN_DAYS) return "EXPIRING";
  return "VALID";
}
