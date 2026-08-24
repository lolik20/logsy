// Автогенерация правовых документов проекта: политики обработки персональных данных,
// публичной оферты и текста согласия.
//
// Как это устроено. Владелец один раз заполняет реквизиты оператора и состав обработки
// на вкладке «Документы» (модель ProjectLegal). По кнопке «Опубликовать» из этих данных
// рендерятся документы и сохраняются как версии (модель LegalDoc) — снимком, а не ссылкой
// на шаблон. Снимок нужен для доказательства: в журнале согласий записан номер версии, и
// через год видно, с каким именно текстом соглашался посетитель.
//
// Документы живут по постоянному адресу /l/<publicSlug>/<doc> на стороне Logsy, а на сайте
// клиента SDK ставит на них ссылки рядом с галочкой согласия.
//
// ВАЖНО: это шаблоны, а не юридическая консультация. Они закрывают типовой случай сайта
// с формой заявки и оплатой; нетиповые сценарии (биометрия, спецкатегории, передача за
// границу, обработка по поручению) требуют правки юристом. Об этом сказано и в панели.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** Версия шаблонов. Меняется при правке текстов — попадает в LegalDoc.templateVersion. */
export const LEGAL_TEMPLATE_VERSION = "1.0";

export type LegalDocType = "PRIVACY" | "OFFER" | "CONSENT";

export const LEGAL_DOC_TYPES: LegalDocType[] = ["PRIVACY", "OFFER", "CONSENT"];

/** Человеческие названия документов (для панели и заголовков страниц). */
export const LEGAL_DOC_TITLES: Record<LegalDocType, string> = {
  PRIVACY: "Политика в отношении обработки персональных данных",
  OFFER: "Публичная оферта",
  CONSENT: "Согласие на обработку персональных данных",
};

/** Путь документа в публичном адресе: /l/<slug>/privacy. */
export const LEGAL_DOC_SLUGS: Record<LegalDocType, string> = {
  PRIVACY: "privacy",
  OFFER: "offer",
  CONSENT: "consent",
};

/** Тип документа по пути из URL, либо null. */
export function docTypeFromSlug(slug: string): LegalDocType | null {
  const entry = Object.entries(LEGAL_DOC_SLUGS).find(([, value]) => value === slug.toLowerCase());
  return (entry?.[0] as LegalDocType) ?? null;
}

/** Данные, из которых рендерятся документы. */
export interface LegalData {
  operatorType: string; // COMPANY | IP | PERSON
  operatorName: string;
  inn: string | null;
  ogrn: string | null;
  address: string | null;
  email: string;
  phone: string | null;
  siteUrl: string; // адрес сайта, к которому относятся документы
  collectsName: boolean;
  collectsEmail: boolean;
  collectsPhone: boolean;
  collectsAddress: boolean;
  collectsPayment: boolean;
  collectsCookies: boolean;
  purposes: string[];
  thirdParties: string[];
  usesMetrika: boolean;
  usesGa: boolean;
  usesMailing: boolean;
}

/** Случайный публичный слаг документов проекта (16 hex-символов). */
export function generateLegalSlug(): string {
  return crypto.randomBytes(8).toString("hex");
}

/** Абсолютный адрес документа проекта. */
export function legalDocUrl(slug: string, type: LegalDocType): string {
  const base = (process.env.APP_URL || "https://logsy.ru").replace(/\/+$/, "");
  return `${base}/l/${slug}/${LEGAL_DOC_SLUGS[type]}`;
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Список <li> из строк (пустой список схлопывается в прочерк). */
function ul(items: string[]): string {
  if (!items.length) return "<p>—</p>";
  return `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

/** Перечисление через запятую с «и» перед последним элементом. */
function enumerate(items: string[]): string {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
}

/** Состав обрабатываемых данных обычным языком. */
function dataList(d: LegalData): string[] {
  const items: string[] = [];
  if (d.collectsName) items.push("фамилия, имя, отчество");
  if (d.collectsEmail) items.push("адрес электронной почты");
  if (d.collectsPhone) items.push("номер телефона");
  if (d.collectsAddress) items.push("почтовый адрес доставки");
  if (d.collectsPayment) items.push("сведения о заказе и платеже (без данных банковской карты)");
  if (d.collectsCookies) {
    items.push("данные файлов cookie, IP-адрес, сведения о браузере и устройстве, история просмотра страниц сайта");
  }
  return items;
}

/** Реквизиты оператора одной строкой. */
function operatorLine(d: LegalData): string {
  const parts = [d.operatorName];
  if (d.inn) parts.push(`ИНН ${d.inn}`);
  if (d.ogrn) parts.push(`${d.operatorType === "IP" ? "ОГРНИП" : "ОГРН"} ${d.ogrn}`);
  if (d.address) parts.push(`адрес: ${d.address}`);
  return parts.join(", ");
}

/** Дата публикации по-русски. */
function ruDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

/** Политика в отношении обработки персональных данных. */
export function renderPrivacy(d: LegalData, now = new Date()): string {
  const data = dataList(d);
  const purposes = d.purposes.length
    ? d.purposes
    : ["обработка обращений и заявок посетителей сайта", "информирование о ходе оказания услуг"];
  const analytics: string[] = [];
  if (d.usesMetrika) analytics.push("Яндекс.Метрика (ООО «Яндекс», серверы на территории РФ)");
  if (d.usesGa) analytics.push("зарубежные системы веб-аналитики");

  return `
<p class="meta">Редакция от ${ruDate(now)}. Сайт: <a href="${esc(d.siteUrl)}">${esc(d.siteUrl)}</a></p>

<h2>1. Общие положения</h2>
<p>Настоящая Политика определяет порядок обработки и защиты персональных данных физических лиц (далее — Пользователи), пользующихся сайтом ${esc(d.siteUrl)} (далее — Сайт).</p>
<p>Оператором персональных данных является ${esc(operatorLine(d))} (далее — Оператор).</p>
<p>Политика разработана в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных» и размещена в открытом доступе согласно части 2 статьи 18.1 указанного закона.</p>

<h2>2. Какие данные обрабатываются</h2>
<p>Оператор обрабатывает следующие персональные данные, которые Пользователь предоставляет добровольно:</p>
${ul(data)}
<p>Оператор не обрабатывает специальные категории персональных данных (о расе, национальности, политических взглядах, религиозных убеждениях, состоянии здоровья, интимной жизни) и биометрические персональные данные.</p>

<h2>3. Цели обработки</h2>
${ul(purposes)}

<h2>4. Правовые основания</h2>
<p>Обработка осуществляется на основании согласия Пользователя, выраженного путём проставления отметки в форме на Сайте (часть 1 статьи 9 152-ФЗ)${d.collectsPayment ? ", а также в связи с исполнением договора, стороной которого является Пользователь (пункт 5 части 1 статьи 6 152-ФЗ)" : ""}.</p>

<h2>5. Порядок и условия обработки</h2>
<p>Обработка включает сбор, запись, систематизацию, накопление, хранение, уточнение, использование, передачу (в случаях, указанных ниже), блокирование, удаление и уничтожение данных. Обработка осуществляется с использованием средств автоматизации и без них.</p>
<p>Базы данных, содержащие персональные данные граждан Российской Федерации, находятся на территории Российской Федерации (часть 5 статьи 18 152-ФЗ).</p>

<h2>6. Передача третьим лицам</h2>
<p>Оператор не продаёт и не раскрывает персональные данные третьим лицам, за исключением случаев, предусмотренных законом, и передачи следующим лицам, привлечённым для обеспечения работы Сайта:</p>
${ul(d.thirdParties.length ? d.thirdParties : ["хостинг-провайдер Сайта"])}
${analytics.length ? `<p>На Сайте используются системы веб-аналитики: ${esc(enumerate(analytics))}. Они обрабатывают обезличенные данные о поведении Пользователя на Сайте.</p>` : ""}
${d.usesGa ? `<p>Использование зарубежных систем аналитики означает трансграничную передачу данных. До начала такой передачи Оператор уведомляет Роскомнадзор в порядке статьи 12 152-ФЗ.</p>` : ""}

<h2>7. Файлы cookie</h2>
${
  d.collectsCookies
    ? `<p>Сайт использует файлы cookie для корректной работы интерфейса, сохранения настроек и сбора обезличенной статистики. Пользователь может отключить cookie в настройках браузера — часть функций Сайта при этом может работать некорректно.</p>`
    : `<p>Сайт не использует файлы cookie для идентификации Пользователя.</p>`
}

<h2>8. Сроки хранения</h2>
<p>Персональные данные хранятся не дольше, чем этого требуют цели обработки, либо до отзыва согласия Пользователем. По достижении целей или получении отзыва данные уничтожаются в срок, не превышающий 30 дней${d.collectsPayment ? ", если иной срок не установлен законодательством о бухгалтерском учёте и налогах" : ""}.</p>

<h2>9. Права Пользователя</h2>
<p>Пользователь вправе получить сведения об обработке своих данных, потребовать их уточнения, блокирования или уничтожения, а также отозвать согласие в любой момент. Для этого достаточно направить обращение на адрес <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>${d.phone ? ` или по телефону ${esc(d.phone)}` : ""}.</p>
<p>Ответ на обращение направляется в срок, установленный статьёй 20 152-ФЗ.</p>

<h2>10. Защита данных</h2>
<p>Оператор принимает правовые, организационные и технические меры защиты персональных данных от неправомерного доступа, уничтожения, изменения и распространения: передача данных с Сайта осуществляется по защищённому протоколу HTTPS, доступ к данным имеют только уполномоченные лица.</p>

<h2>11. Изменения Политики</h2>
<p>Оператор вправе изменять настоящую Политику. Новая редакция вступает в силу с момента публикации на этой странице.</p>

<h2>12. Контакты</h2>
<p>${esc(operatorLine(d))}<br>Электронная почта: <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>${d.phone ? `<br>Телефон: ${esc(d.phone)}` : ""}</p>
`.trim();
}

/** Публичная оферта. */
export function renderOffer(d: LegalData, now = new Date()): string {
  const seller = d.operatorType === "PERSON" ? "Исполнитель" : "Продавец";
  return `
<p class="meta">Редакция от ${ruDate(now)}. Сайт: <a href="${esc(d.siteUrl)}">${esc(d.siteUrl)}</a></p>

<h2>1. Общие положения</h2>
<p>Настоящий документ является публичной офертой ${esc(operatorLine(d))} (далее — ${seller}) и содержит все существенные условия договора, заключаемого с любым лицом, отозвавшимся на оферту (далее — Покупатель), в соответствии со статьями 435 и 437 Гражданского кодекса РФ.</p>

<h2>2. Предмет договора</h2>
<p>${seller} обязуется передать товары или оказать услуги, представленные на Сайте ${esc(d.siteUrl)}, а Покупатель — принять и оплатить их на условиях настоящей оферты.</p>

<h2>3. Заключение договора</h2>
<p>Договор считается заключённым с момента оформления заказа на Сайте и его подтверждения ${seller === "Продавец" ? "Продавцом" : "Исполнителем"}. Оформляя заказ, Покупатель подтверждает, что ознакомлен с условиями настоящей оферты и согласен с ними.</p>

<h2>4. Цена и оплата</h2>
<p>Цены указываются на Сайте в рублях Российской Федерации. ${seller} вправе изменять цены в одностороннем порядке; цена оформленного и оплаченного заказа изменению не подлежит. Оплата производится способами, указанными на Сайте.</p>

<h2>5. Передача товара, оказание услуг</h2>
<p>Сроки и способы передачи товара либо оказания услуг определяются при оформлении заказа. ${seller} обязуется передать товар надлежащего качества, соответствующий описанию на Сайте.</p>

<h2>6. Возврат и отказ от заказа</h2>
<p>Покупатель — физическое лицо вправе отказаться от товара в порядке и сроки, установленные статьёй 26.1 Закона РФ «О защите прав потребителей»: до передачи товара — в любое время, после передачи — в течение семи дней. Возврат денежных средств производится в срок не более десяти дней с момента получения требования.</p>

<h2>7. Ответственность</h2>
<p>Стороны несут ответственность в соответствии с законодательством Российской Федерации. ${seller} не отвечает за убытки, возникшие из-за предоставления Покупателем недостоверных сведений при оформлении заказа.</p>

<h2>8. Персональные данные</h2>
<p>Обработка персональных данных Покупателя осуществляется в соответствии с Политикой в отношении обработки персональных данных, размещённой на Сайте.</p>

<h2>9. Разрешение споров</h2>
<p>Споры разрешаются путём переговоров, а при недостижении согласия — в суде по правилам подсудности, установленным законодательством Российской Федерации.</p>

<h2>10. Реквизиты</h2>
<p>${esc(operatorLine(d))}<br>Электронная почта: <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>${d.phone ? `<br>Телефон: ${esc(d.phone)}` : ""}</p>
`.trim();
}

/** Полный текст согласия, на который ссылается галочка в форме. */
export function renderConsent(d: LegalData, now = new Date()): string {
  const data = dataList(d);
  const purposes = d.purposes.length ? d.purposes : ["обработка обращения, направленного через форму на Сайте"];
  return `
<p class="meta">Редакция от ${ruDate(now)}. Сайт: <a href="${esc(d.siteUrl)}">${esc(d.siteUrl)}</a></p>

<p>Проставляя отметку в форме на сайте ${esc(d.siteUrl)}, я, действуя свободно, своей волей и в своём интересе, даю согласие ${esc(operatorLine(d))} (далее — Оператор) на обработку моих персональных данных на следующих условиях.</p>

<h2>Перечень персональных данных</h2>
${ul(data)}

<h2>Цели обработки</h2>
${ul(purposes)}

<h2>Перечень действий с данными</h2>
<p>Сбор, запись, систематизация, накопление, хранение, уточнение, использование, блокирование, удаление и уничтожение — с использованием средств автоматизации и без них.</p>

<h2>Срок действия согласия</h2>
<p>Согласие действует до достижения целей обработки либо до его отзыва. Отзыв направляется в свободной форме на адрес <a href="mailto:${esc(d.email)}">${esc(d.email)}</a>; обработка прекращается в срок, не превышающий 30 дней с момента получения отзыва.</p>

${
  d.usesMailing
    ? `<h2>Рекламные сообщения</h2>
<p>Согласие на получение рекламных и информационных сообщений даётся отдельной отметкой и может быть отозвано независимо от настоящего согласия.</p>`
    : ""
}

<p class="meta">Порядок обработки описан в Политике в отношении обработки персональных данных, размещённой на Сайте.</p>
`.trim();
}

/** Текст рядом с галочкой в форме (короткая формулировка для SDK). */
export function consentCheckboxText(d: LegalData): string {
  return `Я соглашаюсь на обработку персональных данных и принимаю условия политики конфиденциальности`;
}

/** Рендер документа нужного типа. */
export function renderLegalDoc(type: LegalDocType, d: LegalData, now = new Date()): string {
  if (type === "PRIVACY") return renderPrivacy(d, now);
  if (type === "OFFER") return renderOffer(d, now);
  return renderConsent(d, now);
}

/** Разбирает JSON-массив строк из поля модели; при мусоре возвращает пустой список. */
export function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** Собирает данные для шаблонов из строки ProjectLegal и домена проекта. */
export function legalDataFrom(
  legal: {
    operatorType: string;
    operatorName: string;
    inn: string | null;
    ogrn: string | null;
    address: string | null;
    email: string;
    phone: string | null;
    siteUrl: string | null;
    collectsName: boolean;
    collectsEmail: boolean;
    collectsPhone: boolean;
    collectsAddress: boolean;
    collectsPayment: boolean;
    collectsCookies: boolean;
    purposes: string;
    thirdParties: string;
    usesMetrika: boolean;
    usesGa: boolean;
    usesMailing: boolean;
  },
  projectDomain: string,
): LegalData {
  return {
    ...legal,
    siteUrl: legal.siteUrl || `https://${projectDomain}`,
    purposes: parseList(legal.purposes),
    thirdParties: parseList(legal.thirdParties),
  };
}

/**
 * Публикует новые версии всех документов проекта: рендерит тексты из текущих данных
 * оператора и сохраняет их снимками. Возвращает опубликованные версии по типам.
 */
export async function publishLegalDocs(projectId: string): Promise<Record<LegalDocType, number>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { domain: true, legal: true },
  });
  if (!project?.legal) throw new Error("Сначала заполните реквизиты оператора");

  const data = legalDataFrom(project.legal, project.domain);
  const now = new Date();
  const versions = {} as Record<LegalDocType, number>;

  for (const type of LEGAL_DOC_TYPES) {
    const last = await prisma.legalDoc.findFirst({
      where: { projectId, type },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    await prisma.legalDoc.create({
      data: {
        projectId,
        type,
        version,
        templateVersion: LEGAL_TEMPLATE_VERSION,
        title: LEGAL_DOC_TITLES[type],
        html: renderLegalDoc(type, data, now),
        publishedAt: now,
      },
    });
    versions[type] = version;
  }
  return versions;
}

/** Последние опубликованные версии документов проекта: {PRIVACY: 3, OFFER: 1, …}. */
export async function currentDocVersions(projectId: string): Promise<Partial<Record<LegalDocType, number>>> {
  const docs = await prisma.legalDoc.findMany({
    where: { projectId },
    orderBy: { version: "desc" },
    select: { type: true, version: true },
  });
  const out: Partial<Record<LegalDocType, number>> = {};
  for (const doc of docs) {
    const type = doc.type as LegalDocType;
    if (out[type] === undefined) out[type] = doc.version;
  }
  return out;
}
