import tls from "tls";

/** Порог (в днях), начиная с которого сертификат считаем «скоро истекающим». */
export const SSL_WARN_DAYS = 7;

export interface SslInfo {
  /** Удалось ли получить сертификат. */
  ok: boolean;
  /** Дата окончания действия (notAfter). */
  validTo: Date | null;
  /** Сколько полных дней осталось до окончания (может быть отрицательным). */
  daysLeft: number | null;
  /** Издатель (CA): organization или CN. */
  issuer: string | null;
  /** Текст ошибки, если сертификат получить не удалось. */
  error: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Подключается к хосту по TLS и читает срок действия его SSL-сертификата.
 * Проверка выполняется даже для невалидных сертификатов (истёкших,
 * самоподписанных) — нам важно узнать дату окончания, а не отвергнуть
 * соединение. Порт берётся из аргумента, затем из URL, иначе 443.
 */
export function checkSslCertificate(
  rawUrl: string,
  port: number | null,
  timeoutMs = 10000,
): Promise<SslInfo> {
  const fail = (error: string): SslInfo => ({
    ok: false,
    validTo: null,
    daysLeft: null,
    issuer: null,
    error,
  });

  let host: string;
  let connectPort: number;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") {
      return Promise.resolve(fail("Проверка SSL доступна только для https"));
    }
    host = u.hostname;
    connectPort = port ?? (u.port ? Number(u.port) : 443);
  } catch {
    return Promise.resolve(fail("Некорректный URL"));
  }

  return new Promise<SslInfo>((resolve) => {
    let settled = false;
    const finish = (info: SslInfo) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(info);
    };

    const socket = tls.connect(
      {
        host,
        port: connectPort,
        servername: host, // SNI — важно для хостов с несколькими сертификатами
        // Читаем сертификат даже если он невалиден (истёк/самоподписан).
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      () => {
        const cert = socket.getPeerCertificate();
        if (!cert || Object.keys(cert).length === 0 || !cert.valid_to) {
          finish(fail("Сертификат не получен"));
          return;
        }
        const validTo = new Date(cert.valid_to);
        if (Number.isNaN(validTo.getTime())) {
          finish(fail("Не удалось разобрать срок действия сертификата"));
          return;
        }
        const daysLeft = Math.floor((validTo.getTime() - Date.now()) / DAY_MS);
        // Поля issuer могут быть строкой или массивом строк — приводим к строке.
        const rawIssuer = cert.issuer?.O || cert.issuer?.CN || null;
        const issuer = Array.isArray(rawIssuer) ? rawIssuer[0] ?? null : rawIssuer;
        finish({ ok: true, validTo, daysLeft, issuer, error: null });
      },
    );

    socket.on("timeout", () => finish(fail(`Таймаут TLS-соединения (${timeoutMs} мс)`)));
    socket.on("error", (err) =>
      finish(fail(err instanceof Error ? err.message : "Ошибка TLS-соединения")),
    );
  });
}

/** Выводит статус сертификата из числа оставшихся дней. */
export function sslStatusFromDays(ok: boolean, daysLeft: number | null): string {
  if (!ok || daysLeft === null) return "ERROR";
  if (daysLeft < 0) return "EXPIRED";
  if (daysLeft <= SSL_WARN_DAYS) return "EXPIRING";
  return "VALID";
}
