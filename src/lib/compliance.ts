// Проверка сайта на соответствие 152-ФЗ по результатам обхода (см. src/lib/siteScanner.ts).
//
// Никаких дополнительных запросов к сайту: анализируем то, что обход уже увидел глазами
// браузера — формы и их галочки, ссылки на правовые документы, плашку про cookie,
// сторонние хосты, реквизиты в подвале и протокол.
//
// Важно: это техническая проверка, а не юридическое заключение. Она показывает то, что
// видно снаружи, и не может знать, подано ли уведомление в Роскомнадзор, есть ли договоры
// поручения с подрядчиками и где физически лежит база. Так и написано в отчёте.

import type { ScanReport } from "@/lib/siteScanner";

export type ComplianceStatus = "ok" | "warn" | "fail" | "unknown";

/** Одна проверка соответствия: что смотрели, что нашли и что с этим делать. */
export interface ComplianceCheck {
  id: string;
  title: string;
  status: ComplianceStatus;
  /** Что именно нашли на сайте (конкретика: адреса страниц, имена хостов). */
  detail: string;
  /** Норма, из которой следует требование. */
  law: string;
  /** Что нужно сделать владельцу сайта. */
  fix: string;
  /** Чем закрывается в Logsy — null, если это не наша зона. */
  logsy: string | null;
  /** Вес проверки в итоговом балле. */
  weight: number;
}

export interface ComplianceReport {
  /** Итоговый балл 0…100: доля выполненных требований с учётом весов. */
  score: number;
  /** critical — есть нарушения с риском штрафа, risky — только замечания, ok — чисто. */
  level: "critical" | "risky" | "ok";
  checks: ComplianceCheck[];
  summary: { fail: number; warn: number; ok: number; unknown: number };
}

// Сторонние сервисы, у которых серверы за пределами РФ: их подключение означает
// трансграничную передачу данных посетителя (ст. 12 152-ФЗ) и требует отдельного
// уведомления в Роскомнадзор до начала передачи.
const FOREIGN_HOST_RE =
  /(google-analytics\.com|googletagmanager\.com|google\.com|gstatic\.com|googleapis\.com|doubleclick\.net|googlesyndication\.com|facebook\.(net|com)|fbcdn\.net|hotjar\.com|clarity\.ms|mouseflow\.com|amplitude\.com|mixpanel\.com|segment\.(io|com)|intercom\.io|hubspot\.com|tiktok\.com|twitter\.com|x\.com|linkedin\.com|cloudflareinsights\.com|sentry\.io|jsdelivr\.net|unpkg\.com|bootstrapcdn\.com|cdnjs\.cloudflare\.com)$/i;

/** Хост похож на аналитику/рекламу (а не на CDN картинок или платёжку)? */
const ANALYTICS_HOST_RE =
  /(mc\.yandex\.|metrika|analytics|googletagmanager|doubleclick|googlesyndication|top\.mail\.ru|hotjar|clarity\.ms|mixpanel|amplitude|segment\.|facebook\.(net|com)|vk\.com\/rtrg|tiktok)/i;

/** Короткий список адресов через запятую — чтобы деталь не превращалась в простыню. */
function list(items: string[], max = 5): string {
  const head = items.slice(0, max).join(", ");
  return items.length > max ? `${head} и ещё ${items.length - max}` : head;
}

/** Путь URL без хвостового слэша — для сверки ссылки со страницами обхода. */
function pathOf(url: string): string | null {
  try {
    const p = new URL(url).pathname.replace(/\/+$/, "");
    return p || "/";
  } catch {
    return null;
  }
}

/**
 * Оценивает соответствие сайта требованиям 152-ФЗ по отчёту обхода.
 * Возвращает список проверок со статусами и итоговый балл.
 */
export function analyzeCompliance(report: ScanReport): ComplianceReport {
  const checks: ComplianceCheck[] = [];
  const add = (c: ComplianceCheck) => checks.push(c);

  const pdForms = report.forms.filter((f) => f.personalData && !f.skippedPayment);
  const privacyLinks = report.legalLinks.filter((l) => l.kind === "privacy" || l.kind === "consent");
  const offerLinks = report.legalLinks.filter((l) => l.kind === "offer");

  // 1. Политика обработки персональных данных: документ должен быть опубликован и открываться.
  const brokenPrivacy = privacyLinks.filter((l) => {
    if (!l.internal) return false;
    const path = pathOf(l.url);
    const page = report.pages.find((p) => p.path === path);
    return !!page && page.status >= 400;
  });
  if (!privacyLinks.length) {
    add({
      id: "privacy-doc",
      title: "Политика обработки персональных данных",
      status: "fail",
      detail: "Ссылку на политику на сайте не нашли — ни в подвале, ни в формах.",
      law: "ч. 2 ст. 18.1 152-ФЗ — документ должен быть опубликован в открытом доступе",
      fix: "Опубликуйте политику на отдельной странице и поставьте ссылку в подвал каждой страницы.",
      logsy: "Панель Logsy генерирует политику по вашим реквизитам и держит её по постоянной ссылке.",
      weight: 3,
    });
  } else if (brokenPrivacy.length) {
    add({
      id: "privacy-doc",
      title: "Политика обработки персональных данных",
      status: "fail",
      detail: `Ссылка на политику есть, но страница не открывается: ${list(brokenPrivacy.map((l) => l.url))}.`,
      law: "ч. 2 ст. 18.1 152-ФЗ — документ должен быть доступен неограниченному кругу лиц",
      fix: "Почините страницу политики — сейчас посетитель получает ошибку вместо документа.",
      logsy: "Мониторинг Logsy заметит падение страницы политики так же, как падение любой другой.",
      weight: 3,
    });
  } else {
    add({
      id: "privacy-doc",
      title: "Политика обработки персональных данных",
      status: "ok",
      detail: `Нашли ссылку: ${list(privacyLinks.map((l) => l.url), 3)}.`,
      law: "ч. 2 ст. 18.1 152-ФЗ",
      fix: "Проверьте, что в документе указаны все цели обработки и актуальные реквизиты оператора.",
      logsy: null,
      weight: 3,
    });
  }

  // 2. Галочка согласия в формах, собирающих персональные данные.
  const noConsent = pdForms.filter((f) => f.consent === "none");
  const softConsent = pdForms.filter((f) => f.consent === "optional");
  if (!pdForms.length) {
    add({
      id: "form-consent",
      title: "Согласие на обработку данных в формах",
      status: "unknown",
      detail: "Формы с персональными данными при обходе не встретились — проверить нечего.",
      law: "ч. 1 ст. 9 152-ФЗ",
      fix: "Если формы появятся (заявка, обратный звонок, регистрация) — добавьте в них галочку согласия.",
      logsy: null,
      weight: 0,
    });
  } else if (noConsent.length) {
    add({
      id: "form-consent",
      title: "Согласие на обработку данных в формах",
      status: "fail",
      detail: `${noConsent.length} из ${pdForms.length} форм собирают персональные данные без галочки согласия: ${list(noConsent.map((f) => f.page))}.`,
      law: "ч. 1 ст. 9 152-ФЗ — обработка допускается только с согласия субъекта",
      fix: "Добавьте в форму обязательную галочку со ссылкой на политику и сохраняйте факт согласия.",
      logsy: "Logsy встраивает галочку в формы сайта одной строкой и пишет журнал согласий.",
      weight: 3,
    });
  } else if (softConsent.length) {
    add({
      id: "form-consent",
      title: "Согласие на обработку данных в формах",
      status: "warn",
      detail: `Галочка есть, но форму можно отправить и без неё: ${list(softConsent.map((f) => f.page))}.`,
      law: "ч. 1 ст. 9 152-ФЗ — согласие должно быть конкретным и осознанным",
      fix: "Сделайте галочку обязательной: без неё отправка формы не должна проходить.",
      logsy: "В Logsy это режим STRICT — SDK не даёт отправить форму без согласия.",
      weight: 3,
    });
  } else {
    add({
      id: "form-consent",
      title: "Согласие на обработку данных в формах",
      status: "ok",
      detail: `Во всех ${pdForms.length} формах с персональными данными есть обязательная галочка.`,
      law: "ч. 1 ст. 9 152-ФЗ",
      fix: "Убедитесь, что факт согласия где-то фиксируется — иначе его нечем подтвердить при проверке.",
      logsy: "Журнал согласий Logsy хранит время, страницу и версию документа по каждой галочке.",
      weight: 3,
    });
  }

  // 3. Ссылка на политику рядом с галочкой — без неё согласие не «информированное».
  const noLink = pdForms.filter((f) => f.consent !== "none" && !f.consentLink);
  if (pdForms.length) {
    add({
      id: "consent-link",
      title: "Ссылка на документ рядом с галочкой",
      status: noLink.length ? "warn" : "ok",
      detail: noLink.length
        ? `В ${noLink.length} формах у галочки нет ссылки на политику: ${list(noLink.map((f) => f.page))}.`
        : "У галочек есть ссылка на документ — посетитель может прочитать, на что соглашается.",
      law: "ч. 4 ст. 9 152-ФЗ — согласие должно быть информированным",
      fix: "Поставьте рядом с галочкой ссылку на политику и текст согласия.",
      logsy: "Logsy подставляет ссылки на сгенерированные документы автоматически.",
      weight: 2,
    });
  }

  // 4. Отдельная галочка на рекламную рассылку.
  if (pdForms.length) {
    const hasMarketing = report.forms.some((f) => f.marketingConsent);
    add({
      id: "marketing-consent",
      title: "Отдельное согласие на рассылку",
      status: hasMarketing ? "ok" : "unknown",
      detail: hasMarketing
        ? "На сайте есть отдельная галочка согласия на рассылку — это правильно."
        : "Отдельной галочки на рекламную рассылку не нашли. Если рассылки нет — всё в порядке.",
      law: "ч. 1 ст. 18 ФЗ «О рекламе» — реклама допускается только с предварительного согласия",
      fix: "Если шлёте письма и SMS с акциями — заведите вторую галочку, не смешивая её с согласием на обработку.",
      logsy: "Вторая галочка настраивается в панели вместе с основной.",
      weight: 1,
    });
  }

  // 5. Передача данных формы на сторонний домен.
  const externalForms = pdForms.filter((f) => {
    try {
      const a = new URL(f.action).hostname.toLowerCase();
      const b = new URL(report.finalUrl).hostname.toLowerCase();
      return a !== b && !a.endsWith("." + b) && !b.endsWith("." + a);
    } catch {
      return false;
    }
  });
  if (externalForms.length) {
    add({
      id: "form-external",
      title: "Форма отправляет данные на сторонний сервис",
      status: "warn",
      detail: `Данные уходят на чужой домен: ${list(externalForms.map((f) => f.action))}.`,
      law: "ч. 3 ст. 6 152-ФЗ — поручение обработки третьему лицу требует договора и согласия",
      fix: "Укажите этого подрядчика в политике и заключите с ним договор поручения обработки.",
      logsy: null,
      weight: 2,
    });
  }

  // 6. Формы по HTTP.
  const insecureForms = report.forms.filter((f) =>
    f.issues.some((i) => /незащищённ/i.test(i.message)),
  );
  add({
    id: "https",
    title: "Данные передаются по защищённому соединению",
    status: report.finalUrl.startsWith("https:") && !insecureForms.length ? "ok" : "fail",
    detail: !report.finalUrl.startsWith("https:")
      ? "Сайт открывается по HTTP — данные форм идут открытым текстом."
      : insecureForms.length
        ? `Формы отправляют данные по HTTP: ${list(insecureForms.map((f) => f.page))}.`
        : "Сайт и формы работают по HTTPS.",
    law: "ч. 1 ст. 19 152-ФЗ — оператор обязан принимать меры защиты при обработке",
    fix: "Переведите сайт и все формы на HTTPS, старые адреса закройте редиректом.",
    logsy: "Logsy следит за сроком SSL-сертификата и предупреждает за неделю до истечения.",
    weight: 3,
  });

  // 7. Плашка про cookie и загрузка аналитики.
  const analytics = report.trackers.filter((h) => ANALYTICS_HOST_RE.test(h));
  if (analytics.length) {
    add({
      id: "cookie-notice",
      title: "Информирование о cookie",
      status: report.cookieNotice ? "warn" : "fail",
      detail: report.cookieNotice
        ? `Плашка про cookie есть, но счётчики грузятся сразу при заходе: ${list(analytics)}. Согласие спрашивается уже после сбора данных.`
        : `Счётчики и пиксели работают без какого-либо уведомления: ${list(analytics)}.`,
      law: "ст. 9 152-ФЗ и разъяснения РКН: идентификаторы cookie — персональные данные",
      fix: "Покажите баннер до загрузки счётчиков и запускайте аналитику только после согласия.",
      logsy: "В Logsy включается баннер cookie с фиксацией выбора посетителя.",
      weight: 2,
    });
  } else {
    add({
      id: "cookie-notice",
      title: "Информирование о cookie",
      status: report.cookieNotice ? "ok" : "unknown",
      detail: report.cookieNotice
        ? "Плашка про cookie на сайте есть, сторонних счётчиков при обходе не встретили."
        : "Сторонних счётчиков при обходе не встретили — баннер может и не понадобиться.",
      law: "ст. 9 152-ФЗ",
      fix: "Если подключите метрику или рекламные пиксели — добавьте баннер и спрашивайте согласие.",
      logsy: null,
      weight: 1,
    });
  }

  // 8. Трансграничная передача.
  const foreign = report.trackers.filter((h) => FOREIGN_HOST_RE.test(h));
  add({
    id: "cross-border",
    title: "Передача данных за границу",
    status: foreign.length ? "warn" : "ok",
    detail: foreign.length
      ? `Страницы обращаются к зарубежным сервисам: ${list(foreign)}. IP и cookie посетителя уходят за пределы РФ.`
      : "Обращений к зарубежным сервисам при обходе не встретили.",
    law: "ст. 12 152-ФЗ — трансграничная передача требует отдельного уведомления в РКН",
    fix: "Замените зарубежные счётчики и шрифты на российские аналоги либо подайте уведомление о трансграничной передаче.",
    logsy: "Logsy размещён в РФ и хранит логи и записи сессий здесь же.",
    weight: 2,
  });

  // 9. Реквизиты оператора.
  const { inn, ogrn, name } = report.operator;
  const hasContacts = report.emails.length > 0;
  const known = [name, inn ? `ИНН ${inn}` : null, ogrn ? `ОГРН ${ogrn}` : null].filter(Boolean) as string[];
  add({
    id: "operator",
    title: "Кто оператор и как с ним связаться",
    status: (inn || ogrn) && hasContacts ? "ok" : inn || ogrn || hasContacts ? "warn" : "fail",
    detail: known.length || hasContacts
      ? `На сайте нашли: ${[...known, hasContacts ? `почта ${report.emails[0]}` : null].filter(Boolean).join(", ")}.`
      : "Ни наименования с ИНН, ни почты для обращений на сайте не нашли.",
    law: "п. 1 ч. 1 ст. 14 152-ФЗ — субъект вправе знать оператора и обратиться к нему",
    fix: "Разместите в подвале наименование, ИНН/ОГРН и адрес почты для обращений по персональным данным.",
    logsy: "Реквизиты вводятся один раз в панели и подставляются во все документы.",
    weight: 2,
  });

  // 10. Публичная оферта — для сайтов, где что-то продают.
  const hasPayment = report.forms.some((f) => f.skippedPayment);
  if (hasPayment || offerLinks.length) {
    add({
      id: "offer",
      title: "Публичная оферта и условия",
      status: offerLinks.length ? "ok" : "warn",
      detail: offerLinks.length
        ? `Нашли документ: ${list(offerLinks.map((l) => l.url), 3)}.`
        : "На сайте есть платёжная форма, но публичной оферты или условий продажи не нашли.",
      law: "ст. 437 ГК РФ и ст. 26.1 закона «О защите прав потребителей»",
      fix: "Опубликуйте оферту с описанием товара, цены, порядка оплаты, доставки и возврата.",
      logsy: "Оферта генерируется в панели вместе с политикой.",
      weight: 1,
    });
  }

  // 11. Уведомление в Роскомнадзор — снаружи не проверяется, но забывают о нём чаще всего.
  add({
    id: "rkn-notice",
    title: "Уведомление в Роскомнадзор",
    status: "unknown",
    detail: "Проверить снаружи невозможно: подача уведомления видна только в реестре операторов.",
    law: "ч. 1 ст. 22 152-ФЗ — уведомить нужно ДО начала обработки, штраф по ст. 19.7 КоАП",
    fix: "Проверьте себя в реестре операторов на pd.rkn.gov.ru; если вас там нет — подайте уведомление.",
    logsy: "Панель напоминает об этом, если дата подачи не указана в настройках проекта.",
    weight: 0,
  });

  const summary = { fail: 0, warn: 0, ok: 0, unknown: 0 };
  let earned = 0;
  let possible = 0;
  for (const c of checks) {
    summary[c.status] += 1;
    if (c.status === "unknown" || c.weight === 0) continue;
    possible += c.weight;
    if (c.status === "ok") earned += c.weight;
    else if (c.status === "warn") earned += c.weight / 2;
  }
  const score = possible ? Math.round((earned / possible) * 100) : 0;
  const level: ComplianceReport["level"] = summary.fail > 0 ? "critical" : summary.warn > 0 ? "risky" : "ok";

  return { score, level, checks, summary };
}
