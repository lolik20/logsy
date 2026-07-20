// Холодная рассылка по почтам, найденным при обходе сайта. Собирает «вызывающее» HTML-письмо
// с кратким скриншотом отчёта и призывом подключить Logsy. Скриншот рендерится настоящим
// headless-браузером (тот же Chromium, что и обход) — компактная карточка-дашборд, снятая в
// PNG и встроенная в письмо по CID. В письме есть трекинг-пиксель открытия и ссылка отписки.
//
// О доставляемости («не в спам»): письмо соблюдает базовые правила — реальный From на домене
// logsy.ru, Reply-To на живой ящик, текстовая версия рядом с HTML, заголовок List-Unsubscribe
// и рабочая отписка. Это необходимые, но не достаточные условия: попадание во «Входящие»
// определяется прежде всего SPF/DKIM/DMARC на DNS домена и его репутацией (см. README).

import type { ScanReport } from "@/lib/siteScanner";
import { launchBrowser } from "@/lib/siteScanner";

function baseUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://logsy.ru").replace(/\/$/, "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} мс`;
  return `${(ms / 1000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} с`;
}

/** Оценка «серьёзности» находок — для заголовка письма и вердикта. */
export interface Verdict {
  subject: string;
  headline: string;
  sub: string;
  tone: "critical" | "warning" | "ok";
}

export function buildVerdict(report: ScanReport, domain: string): Verdict {
  const { errors, slow } = report.summary;
  const slowPage = report.summary.avgPageMs >= 2000;
  if (errors > 0) {
    return {
      subject: `На сайте ${domain} нашли ${errors} ${plural(errors, "ошибку", "ошибки", "ошибок")} — клиенты уходят`,
      headline: `На вашем сайте прямо сейчас ${errors} ${plural(errors, "ошибка", "ошибки", "ошибок")}`,
      sub: "Из-за таких ошибок люди не могут оформить заказ или оплатить — и уходят к конкурентам. Вы можете этого не замечать, а мы уже нашли.",
      tone: "critical",
    };
  }
  if (slow > 0 || slowPage) {
    return {
      subject: `${domain} грузится слишком медленно — вы теряете клиентов`,
      headline: "Ваш сайт грузится слишком медленно",
      sub: "Больше половины посетителей уходят, не дождавшись загрузки. Вы платите за рекламу и трафик — и теряете его на первых секундах ожидания.",
      tone: "warning",
    };
  }
  return {
    subject: `Проверили ${domain}: что вы не видите на своём сайте`,
    headline: "Сегодня сайт в порядке. А завтра?",
    sub: "Вы видите сайт только со своего компьютера и только сейчас. А что происходит у клиентов, ночью, под нагрузкой, когда падает оплата — кто вам скажет?",
    tone: "ok",
  };
}

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/** Завлекающий призыв к действию по результатам обхода (для письма и PDF). */
export interface Cta {
  button: string; // текст кнопки
  lead: string; // подводящая строка над кнопкой
}

export function buildCta(report: ScanReport): Cta {
  const { errors, slow, avgPageMs } = report.summary;
  if (errors > 0) {
    const e = `${errors} ${plural(errors, "ошибку", "ошибки", "ошибок")}`;
    return {
      button: `Поправим ${e} на сайте — бесплатно`,
      lead: `Подключите Logsy — и мы поможем убрать ${e} с вашего сайта. Абсолютно бесплатно.`,
    };
  }
  if (slow > 0 || avgPageMs >= 2000) {
    return {
      button: "Ускорим ваш сайт — бесплатно",
      lead: "Подключите Logsy — покажем, что именно тормозит, и поможем ускорить сайт. Бесплатно.",
    };
  }
  return {
    button: "Возьмём сайт под контроль — бесплатно",
    lead: "Подключите Logsy — и узнавайте о проблемах раньше клиентов. Бесплатно.",
  };
}

// -------------------- Скриншот отчёта (карточка-дашборд) --------------------

/** HTML компактной карточки-дашборда для скриншота (тёмная, «дорогая», вызывающая тревогу). */
function screenshotHtml(report: ScanReport, domain: string): string {
  const v = buildVerdict(report, domain);
  const s = report.summary;
  const accent = v.tone === "critical" ? "#ef4444" : v.tone === "warning" ? "#f59e0b" : "#22c55e";

  const topIssues = [
    ...report.backendErrors.slice(0, 3).map((e) => ({
      badge: e.status === 0 ? "нет ответа" : String(e.status),
      color: e.kind === "server" ? "#ef4444" : e.kind === "network" ? "#94a3b8" : "#f59e0b",
      text: e.url.replace(/^https?:\/\//, ""),
    })),
    ...report.slowRequests.slice(0, 2).map((sl) => ({
      badge: formatMs(sl.ms),
      color: "#f59e0b",
      text: sl.url.replace(/^https?:\/\//, ""),
    })),
  ].slice(0, 4);

  const tile = (value: string | number, label: string, color: string) => `
    <div style="flex:1;background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:14px 8px;text-align:center;">
      <div style="font-size:26px;font-weight:800;color:${color};line-height:1;">${value}</div>
      <div style="font-size:11px;color:#64748b;margin-top:6px;">${label}</div>
    </div>`;

  const issueRow = (i: { badge: string; color: string; text: string }) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #1e293b;">
      <span style="flex:none;font-size:11px;font-weight:700;color:#fff;background:${i.color};border-radius:5px;padding:2px 7px;">${escapeHtml(i.badge)}</span>
      <span style="flex:1;font-size:12px;color:#cbd5e1;font-family:ui-monospace,Menlo,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(i.text.length > 52 ? i.text.slice(0, 50) + "…" : i.text)}</span>
    </div>`;

  return `<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;}</style></head>
<body style="background:#020617;padding:24px;">
  <div id="card" style="width:640px;background:linear-gradient(135deg,#0b1220,#111827);border:1px solid #1e293b;border-radius:20px;padding:26px;color:#e2e8f0;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:9px;background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;font-weight:800;font-size:16px;">L</span>
        <span style="font-size:18px;font-weight:800;color:#fff;">Отчёт по сайту</span>
      </div>
      <span style="font-size:13px;color:#94a3b8;font-family:ui-monospace,monospace;">${escapeHtml(domain)}</span>
    </div>

    <div style="border-left:4px solid ${accent};background:rgba(148,163,184,0.06);border-radius:10px;padding:12px 14px;margin-bottom:18px;">
      <div style="font-size:17px;font-weight:800;color:#fff;">${escapeHtml(v.headline)}</div>
      <div style="font-size:13px;color:#94a3b8;margin-top:4px;">${escapeHtml(v.sub)}</div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:18px;">
      ${tile(s.errors, "Ошибок на сайте", s.errors ? "#ef4444" : "#e2e8f0")}
      ${tile(s.slow, "Медленных мест", s.slow ? "#f59e0b" : "#e2e8f0")}
      ${tile(report.pagesCrawled, "Страниц", "#e2e8f0")}
      ${tile(formatMs(s.avgPageMs), "Среднее время", s.avgPageMs >= 2000 ? "#f59e0b" : "#e2e8f0")}
    </div>

    ${
      topIssues.length
        ? `<div style="background:#0b1220;border:1px solid #1e293b;border-radius:12px;padding:6px 14px 12px;">
             <div style="font-size:12px;color:#64748b;padding:10px 0 2px;font-weight:600;">Что нашли на сайте:</div>
             ${topIssues.map(issueRow).join("")}
           </div>`
        : `<div style="background:#0b1220;border:1px solid #1e293b;border-radius:12px;padding:14px;font-size:13px;color:#94a3b8;">Серьёзных ошибок при быстрой проверке не видно — но это лишь один момент из жизни сайта.</div>`
    }
  </div>
</body></html>`;
}

/** Рендерит карточку-дашборд в PNG. Возвращает null, если браузер недоступен. */
export async function renderReportScreenshot(
  report: ScanReport,
  domain: string,
): Promise<Buffer | null> {
  let browser;
  try {
    browser = await launchBrowser();
    const context = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.setContent(screenshotHtml(report, domain), { waitUntil: "load" });
    const card = page.locator("#card");
    const buf = await card.screenshot({ type: "png" });
    return buf as Buffer;
  } catch (err) {
    console.error("[Logsy] Не удалось снять скриншот отчёта:", err);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

// -------------------- Сборка письма --------------------

export interface OutreachEmail {
  subject: string;
  html: string;
  text: string;
  listUnsubscribe: string;
}

export function buildOutreachEmail(opts: {
  report: ScanReport;
  domain: string;
  token: string;
  hasShot: boolean; // встроен ли CID-скриншот
  hasPdf?: boolean; // приложен ли полный PDF-отчёт
}): OutreachEmail {
  const { report, domain, token, hasShot, hasPdf } = opts;
  const app = baseUrl();
  const v = buildVerdict(report, domain);
  const s = report.summary;

  const ctaUrl = `${app}/register?utm_source=outreach&utm_medium=email&utm_campaign=scan&utm_content=${encodeURIComponent(domain)}`;
  const cta = buildCta(report);
  const pixel = `${app}/api/track/open/${token}.png`;
  const unsub = `${app}/api/outreach/unsubscribe/${token}`;
  const listUnsubscribe = `<${unsub}>, <mailto:${supportEmail()}?subject=unsubscribe>`;

  // Ключевые находки — текстом, чтобы сообщение доходило даже при заблокированных картинках.
  const findings: string[] = [];
  if (s.errors) findings.push(`${s.errors} ${plural(s.errors, "ошибка", "ошибки", "ошибок")} на сайте`);
  if (s.slow) findings.push(`${s.slow} ${plural(s.slow, "медленная загрузка", "медленные загрузки", "медленных загрузок")}`);
  findings.push(`проверили ${report.pagesCrawled} ${plural(report.pagesCrawled, "страницу", "страницы", "страниц")}`);
  if (s.avgPageMs) findings.push(`страница грузится в среднем ${formatMs(s.avgPageMs)}`);

  const statChip = (value: string | number, label: string, color: string) => `
    <td style="padding:6px;" width="25%">
      <div style="background:#f8fafc;border:1px solid #e9edf3;border-radius:12px;padding:12px 6px;text-align:center;">
        <div style="font-size:22px;font-weight:800;color:${color};line-height:1;">${value}</div>
        <div style="font-size:11px;color:#64748b;margin-top:5px;">${label}</div>
      </div>
    </td>`;

  const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(v.subject)}</title></head>
<body style="margin:0;padding:0;background:#eef2f7;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(v.headline)} — бесплатная проверка сайта ${escapeHtml(domain)} от Logsy.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
        <tr><td style="padding:26px 30px 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:8px;"><span style="display:inline-flex;width:30px;height:30px;align-items:center;justify-content:center;border-radius:8px;background:#4f46e5;color:#fff;font-weight:800;">L</span></td>
            <td style="font-size:18px;font-weight:800;color:#0f172a;">Logsy</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:16px 30px 4px;">
          <div style="font-size:24px;font-weight:800;color:#0f172a;line-height:1.25;">${escapeHtml(v.headline)}</div>
          <p style="font-size:15px;color:#475569;line-height:1.6;margin:12px 0 0;">
            Мы открыли <b>${escapeHtml(domain)}</b> так же, как это делает обычный посетитель, и вот что заметили: <b>${escapeHtml(findings.join(", "))}</b>. ${escapeHtml(v.sub)}
          </p>
        </td></tr>

        <tr><td style="padding:18px 24px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            ${statChip(s.errors, "Ошибок", s.errors ? "#dc2626" : "#0f172a")}
            ${statChip(s.slow, "Медленных", s.slow ? "#d97706" : "#0f172a")}
            ${statChip(report.pagesCrawled, "Страниц", "#0f172a")}
            ${statChip(formatMs(s.avgPageMs), "Ср. время", s.avgPageMs >= 2000 ? "#d97706" : "#0f172a")}
          </tr></table>
        </td></tr>

        ${hasShot ? `<tr><td style="padding:22px 30px 0;"><img src="cid:reportshot" width="540" alt="Отчёт по сайту ${escapeHtml(domain)}" style="display:block;width:100%;border-radius:16px;border:1px solid #e2e8f0;" /></td></tr>` : ""}

        <tr><td align="center" style="padding:22px 30px 8px;">
          <div style="font-size:15px;font-weight:600;color:#0f172a;margin-bottom:14px;">${escapeHtml(cta.lead)}</div>
          <a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;background:linear-gradient(90deg,#4f46e5,#6366f1);color:#ffffff;text-decoration:none;font-size:17px;font-weight:800;padding:16px 34px;border-radius:12px;">
            ${escapeHtml(cta.button)} →
          </a>
          <div style="font-size:12px;color:#94a3b8;margin-top:10px;">Бесплатный тариф навсегда · подключение за минуту · без карты</div>
          ${hasPdf ? `<div style="font-size:13px;color:#475569;margin-top:14px;">📎 Полный отчёт по сайту со всеми находками — в приложенном PDF.</div>` : ""}
        </td></tr>

        <tr><td style="padding:18px 30px 0;">
          <div style="border-top:1px solid #eef2f7;padding-top:16px;">
            <p style="font-size:13px;color:#64748b;line-height:1.6;margin:0;">
              Logsy — российский сервис контроля за сайтом: показывает ошибки на сайте и медленные
              страницы, следит, чтобы сайт был доступен и не «отвалился» сертификат, и записывает,
              что делали посетители. Подключите — и увидите проблемы раньше своих клиентов.
            </p>
          </div>
        </td></tr>

        <tr><td style="padding:18px 30px 26px;">
          <p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:0;">
            Вы получили это письмо, потому что адрес указан на сайте ${escapeHtml(domain)} как контактный.
            Если это письмо вам не нужно — <a href="${unsub}" style="color:#64748b;">отписаться в один клик</a>.<br>
            Logsy · <a href="${app}" style="color:#64748b;">logsy.ru</a> · ${escapeHtml(supportEmail())}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
  <img src="${pixel}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
</body></html>`;

  const text =
    `Отчёт по сайту ${domain}\n\n` +
    `${v.headline}\n` +
    `Мы открыли ${domain} как обычный посетитель и заметили: ${findings.join(", ")}.\n` +
    `${v.sub}\n\n` +
    `${cta.lead}\n` +
    `${cta.button}: ${ctaUrl}\n` +
    `Бесплатный тариф навсегда, подключение за минуту.\n` +
    (hasPdf ? `Полный отчёт по сайту — в приложенном PDF.\n` : "") +
    `\n` +
    `— Команда Logsy · ${app}\n` +
    `Отписаться: ${unsub}\n`;

  return { subject: v.subject, html, text, listUnsubscribe };
}

function supportEmail(): string {
  const from = process.env.SMTP_FROM || "support@logsy.ru";
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}
