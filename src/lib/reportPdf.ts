// Генерация PDF-отчёта по обходу сайта. Рендерит «продающий» и полезный документ настоящим
// headless-браузером (page.pdf()) — тот же Chromium, что и обход. В документе: находки по
// сайту простым языком, польза от исправления, что даёт Logsy, CTA в регистрацию, ссылка на
// logsy.ru и телеграм-контакт менеджера. Используется в GET /api/admin/scan/[id]/pdf.

import type { ScanReport } from "@/lib/siteScanner";
import { launchBrowser } from "@/lib/siteScanner";
import { buildVerdict, buildCta } from "@/lib/outreach";

function baseUrl(): string {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://logsy.ru").replace(/\/$/, "");
}

/** Телеграм менеджера: из env или дефолт (совпадает с ссылкой техподдержки в панели). */
function managerTelegram(): { url: string; handle: string } {
  const raw = (process.env.MANAGER_TELEGRAM || "tritex_manager").replace(/^@/, "").trim();
  const handle = raw.replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "");
  return { url: `https://t.me/${handle}`, handle: `@${handle}` };
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

function shortUrl(u: string): string {
  const s = u.replace(/^https?:\/\//, "");
  return s.length > 70 ? s.slice(0, 68) + "…" : s;
}

/** HTML документа отчёта (светлая, печатная тема). */
function buildPdfHtml(report: ScanReport, domain: string): string {
  const app = baseUrl();
  const tg = managerTelegram();
  const v = buildVerdict(report, domain);
  const s = report.summary;
  const cta = `${app}/register?utm_source=report_pdf&utm_medium=pdf&utm_campaign=scan&utm_content=${encodeURIComponent(domain)}`;
  const ctaText = buildCta(report);
  const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const accent = v.tone === "critical" ? "#dc2626" : v.tone === "warning" ? "#d97706" : "#16a34a";

  const issues = [
    ...report.backendErrors.slice(0, 8).map((e) => ({
      badge: e.status === 0 ? "нет ответа" : String(e.status),
      color: e.kind === "server" ? "#dc2626" : e.kind === "network" ? "#64748b" : "#d97706",
      label: "Ошибка",
      url: e.url,
      count: e.count,
    })),
    ...report.slowRequests.slice(0, 6).map((sl) => ({
      badge: formatMs(sl.ms),
      color: "#d97706",
      label: "Медленно",
      url: sl.url,
      count: sl.count,
    })),
    ...(report.jsErrors ?? []).slice(0, 5).map((e) => ({
      badge: "JS",
      color: "#dc2626",
      label: "JS-ошибка",
      url: e.message,
      count: e.count,
    })),
  ];

  // Проблемы форм (заполнение/отправка тестовыми данными при обходе).
  const formIssues = (report.forms ?? []).flatMap((f) =>
    f.issues.map((iss) => ({ severity: iss.severity, message: iss.message, form: `${f.method} ${f.action}` })),
  );
  const formsSubmitted = (report.forms ?? []).filter((f) => f.submitted).length;

  const tile = (value: string | number, label: string, color: string) => `
    <td width="25%" style="padding:6px;">
      <div style="border:1px solid #e6eaf0;border-radius:12px;padding:14px 8px;text-align:center;">
        <div style="font-size:26px;font-weight:800;color:${color};line-height:1;">${value}</div>
        <div style="font-size:11px;color:#64748b;margin-top:6px;">${label}</div>
      </div>
    </td>`;

  const issueRow = (i: (typeof issues)[number]) => `
    <tr>
      <td style="padding:7px 0;border-top:1px solid #eef2f7;white-space:nowrap;vertical-align:top;width:74px;">
        <span style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:${i.color};border-radius:5px;padding:2px 8px;">${escapeHtml(i.badge)}</span>
      </td>
      <td style="padding:7px 0;border-top:1px solid #eef2f7;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#334155;word-break:break-all;">
        ${escapeHtml(shortUrl(i.url))}${i.count > 1 ? ` <span style="color:#94a3b8;">×${i.count}</span>` : ""}
      </td>
    </tr>`;

  // Полезно-продающий блок: во что обходятся находки (простым языком для владельца).
  const painPoints =
    s.errors > 0
      ? [
          "Ошибки на сайте — это брошенные корзины и незавершённые оплаты. Клиент видит сбой, не разбирается в причинах и уходит к конкуренту.",
          "Вы узнаёте о проблеме последним: посетитель не жалуется, а просто закрывает вкладку. Деньги за рекламу уже потрачены — а заявки нет.",
          "Часть ошибок видна только в определённых браузерах, на мобильных или под нагрузкой — на вашем компьютере сайт может выглядеть исправным.",
        ]
      : s.slow > 0 || s.avgPageMs >= 2000
        ? [
            "Каждая лишняя секунда загрузки снижает конверсию: значительная часть посетителей уходит, не дождавшись открытия страницы.",
            "Поисковые системы понижают медленные сайты в выдаче — вы теряете и платный, и бесплатный трафик одновременно.",
            "Медленные места часто прячутся в отдельных запросах и на внутренних страницах, которые вы редко открываете сами.",
          ]
        : [
            "Сейчас сайт выглядит исправным — но это снимок одного момента с одного устройства.",
            "Проблемы появляются внезапно: после обновления, ночью, под нагрузкой или когда «отваливается» оплата. Без постоянного контроля вы узнаёте о них от клиентов.",
            "Важно видеть не только «работает / не работает», но и что именно делают посетители перед уходом.",
          ];

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  @page { size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
  body { color: #0f172a; font-size: 13px; line-height: 1.55; }
  .section { margin-top: 22px; page-break-inside: avoid; }
  h2 { font-size: 16px; margin-bottom: 10px; }
  .muted { color: #64748b; }
  .card { border: 1px solid #e6eaf0; border-radius: 14px; padding: 16px 18px; }
  a { color: #4f46e5; text-decoration: none; }
</style></head>
<body>
  <!-- Шапка -->
  <table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td>
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:9px;"><span style="display:inline-flex;width:34px;height:34px;align-items:center;justify-content:center;border-radius:9px;background:#4f46e5;color:#fff;font-weight:800;font-size:17px;">L</span></td>
        <td><div style="font-size:19px;font-weight:800;">Logsy</div><div style="font-size:11px;color:#94a3b8;">контроль за сайтом · logsy.ru</div></td>
      </tr></table>
    </td>
    <td align="right" class="muted" style="font-size:12px;">Отчёт по сайту<br><b style="color:#0f172a;font-size:14px;">${escapeHtml(domain)}</b><br>${date}</td>
  </tr></table>

  <!-- Вердикт -->
  <div class="section" style="border-left:5px solid ${accent};background:#f8fafc;border-radius:12px;padding:16px 18px;">
    <div style="font-size:20px;font-weight:800;">${escapeHtml(v.headline)}</div>
    <div class="muted" style="margin-top:6px;">${escapeHtml(v.sub)}</div>
  </div>

  <!-- Метрики -->
  <div class="section">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${tile(s.errors, "Ошибок на сайте", s.errors ? "#dc2626" : "#0f172a")}
      ${tile(s.slow, "Медленных мест", s.slow ? "#d97706" : "#0f172a")}
      ${tile(report.pagesCrawled, "Проверено страниц", "#0f172a")}
      ${tile(formatMs(s.avgPageMs), "Загрузка DOM", s.avgPageMs >= 2000 ? "#d97706" : "#0f172a")}
    </tr></table>
  </div>

  ${
    issues.length
      ? `<div class="section"><h2>Что нашли на сайте</h2>
           <div class="card"><table width="100%" cellpadding="0" cellspacing="0">${issues.map(issueRow).join("")}</table></div>
         </div>`
      : `<div class="section"><div class="card muted">Серьёзных ошибок при быстрой проверке не видно — но это лишь один момент из жизни сайта.</div></div>`
  }

  ${
    (report.forms ?? []).length > 0
      ? `<div class="section"><h2>Проверка форм</h2>
           <div class="card">
             <div class="muted" style="margin-bottom:${formIssues.length ? "10px" : "0"};">Проверили ${(report.forms ?? []).length} ${(report.forms ?? []).length === 1 ? "форму" : "форм"}, отправили ${formsSubmitted} с тестовыми данными (формы оплаты пропускали).</div>
             ${formIssues
               .slice(0, 8)
               .map(
                 (fi) =>
                   `<div style="display:flex;gap:9px;margin:0 0 7px;"><span style="flex:none;font-size:11px;font-weight:700;color:#fff;background:${fi.severity === "error" ? "#dc2626" : "#d97706"};border-radius:5px;padding:2px 7px;">${fi.severity === "error" ? "ошибка" : "внимание"}</span><span>${escapeHtml(fi.message)}</span></div>`,
               )
               .join("")}
           </div>
         </div>`
      : ""
  }

  <!-- Полезно-продающий блок -->
  <div class="section">
    <h2>Что это значит для вас</h2>
    <div class="card">
      ${painPoints
        .map(
          (p) =>
            `<div style="display:flex;gap:9px;margin:0 0 9px;"><span style="color:${accent};font-weight:800;">•</span><span>${escapeHtml(p)}</span></div>`,
        )
        .join("")}
      <div style="margin-top:2px;"></div>
    </div>
  </div>

  <!-- Как помогает Logsy -->
  <div class="section">
    <h2>Как Logsy помогает не терять клиентов</h2>
    <div class="card">
      ${[
        ["Видит ошибки раньше клиентов", "Ловит сбои на сайте (в том числе на мобильных и под нагрузкой) и сразу шлёт алерт на почту и в Telegram — вы чините до того, как клиент ушёл."],
        ["Показывает, что тормозит", "Находит медленные страницы и запросы и показывает конкретные места, где посетители теряют терпение."],
        ["Следит за доступностью и SSL", "Проверяет, что сайт открывается, а сертификат и домен не истекают — предупредит заранее."],
        ["Записывает действия посетителей", "Пишет сессии и записывает экран — видно, что именно делал человек перед уходом."],
      ]
        .map(
          ([t, d]) =>
            `<div style="margin-bottom:11px;"><div style="font-weight:700;">${t}</div><div class="muted">${d}</div></div>`,
        )
        .join("")}
    </div>
  </div>

  <!-- CTA -->
  <div class="section" style="border-radius:16px;padding:22px;text-align:center;background:#eef0ff;border:1px solid #dfe3ff;">
    <div style="font-size:18px;font-weight:800;">${escapeHtml(ctaText.lead)}</div>
    <div class="muted" style="margin:6px 0 14px;">Бесплатный тариф навсегда · подключение за минуту · без банковской карты</div>
    <a href="${cta}" style="display:inline-block;background:#4f46e5;color:#fff;font-weight:800;font-size:15px;padding:13px 30px;border-radius:11px;">${escapeHtml(ctaText.button)} →</a>
  </div>

  <!-- Контакты -->
  <div class="section" style="border-top:1px solid #eef2f7;padding-top:14px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td class="muted" style="font-size:12px;">
        Сайт: <a href="${app}">logsy.ru</a><br>
        Менеджер в Telegram: <a href="${tg.url}">${escapeHtml(tg.handle)}</a>
      </td>
      <td align="right" class="muted" style="font-size:11px;">
        Отчёт сформирован автоматически сервисом Logsy.<br>Это разовая проверка одного момента — постоянный контроль даёт подключение.
      </td>
    </tr></table>
  </div>
</body></html>`;
}

/** Рендерит PDF-отчёт. Кидает ошибку, если браузер недоступен. */
export async function renderReportPdf(report: ScanReport, domain: string): Promise<Buffer> {
  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(buildPdfHtml(report, domain), { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return pdf as Buffer;
  } finally {
    await browser?.close().catch(() => {});
  }
}
