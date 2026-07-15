import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage } from "@/lib/telegram";
import { isProjectServiceActive } from "@/lib/subscription";
import { checkDomainRegistration, domainStatusFromDays, DomainInfo } from "@/lib/domain";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Пороги предупреждений в днях (по убыванию срочности): за 30, 14, 7, 3 и 1 день
// до окончания регистрации. Значение 0 отвечает за «регистрация истекла».
// Каждое предупреждение отправляется один раз — см. Project.domainAlertDays.
const ALERT_THRESHOLDS_D = [30, 14, 7, 3, 1];

type ProjectDomainRow = {
  id: string;
  userId: string;
  name: string;
  domain: string;
  checkDomain: boolean;
  domainStatus: string;
  domainDaysLeft: number | null;
  domainCheckedAt: Date | null;
  domainAlertDays: number | null;
};

/**
 * Как часто перепроверять срок регистрации. Регистрация меняется редко
 * (продлевается на год), поэтому в спокойном режиме проверяем раз в сутки, а
 * ближе к окончанию — чаще, чтобы не пропустить пороги «за 1 день» / «истёк».
 */
function checkIntervalMs(daysLeft: number | null): number {
  if (daysLeft == null) return 12 * HOUR_MS; // ещё не знаем — попробуем через 12 ч
  if (daysLeft > 30) return DAY_MS; // спокойный режим — раз в сутки
  if (daysLeft > 1) return 6 * HOUR_MS; // последний месяц — каждые 6 часов
  return HOUR_MS; // меньше суток — раз в час (поймать порог 1д / истёк)
}

function isDomainCheckDue(project: ProjectDomainRow, now: Date): boolean {
  if (!project.domainCheckedAt) return true;
  return now.getTime() - project.domainCheckedAt.getTime() >= checkIntervalMs(project.domainDaysLeft);
}

/**
 * Самый срочный (наименьший) достигнутый порог предупреждения в днях:
 * 30 | 14 | 7 | 3 | 1, либо 0 если регистрация уже истекла, либо null если до
 * окончания ещё больше 30 дней.
 */
function currentAlertLevel(daysLeft: number): number | null {
  if (daysLeft <= 0) return 0;
  let level: number | null = null;
  for (const t of ALERT_THRESHOLDS_D) {
    if (daysLeft <= t && (level === null || t < level)) level = t;
  }
  return level;
}

/** Человекочитаемое описание порога для темы/текста письма. */
function levelPhrase(level: number): string {
  switch (level) {
    case 0:
      return "истёк";
    case 1:
      return "истекает менее чем через 1 день";
    case 3:
      return "истекает менее чем через 3 дня";
    case 7:
      return "истекает менее чем через неделю";
    case 14:
      return "истекает менее чем через 2 недели";
    case 30:
      return "истекает менее чем через месяц";
    default:
      return "скоро истекает";
  }
}

async function notifyProjectDomain(
  project: ProjectDomainRow,
  level: number,
  info: DomainInfo,
): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId },
  });
  if (contacts.length === 0) return;

  const expired = level === 0;
  const when = info.expiresAt ? info.expiresAt.toLocaleString("ru-RU") : "неизвестно";
  const phrase = levelPhrase(level);
  const subject = expired
    ? `🔴 Регистрация домена ${project.domain} истекла`
    : `⚠️ Срок регистрации домена ${project.domain} ${phrase}`;
  const detail = expired
    ? `Срок регистрации домена ${project.domain} истёк ${when}. Домен могут снять с делегирования — сайт станет недоступен.`
    : `Срок регистрации домена ${project.domain} ${phrase} — действует до ${when}. Продлите регистрацию у регистратора.`;
  const text =
    `Проект: ${project.name}\n` +
    `Домен: ${project.domain}\n` +
    `${detail}\n` +
    (info.registrar ? `Регистратор: ${info.registrar}\n` : "") +
    `Время проверки: ${new Date().toLocaleString("ru-RU")}\n`;

  // DOMAIN-алерты привязываем к первому монитору проекта (schema Alert требует
  // monitorId и contactId). Если мониторов ещё нет — письмо всё равно уходит,
  // просто без записи в истории алертов.
  const monitor = await prisma.monitor.findFirst({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const contact of contacts) {
    // Email рассылаем только на подтверждённые адреса (верификация контактов).
    if (contact.type === "EMAIL" && !contact.verified) continue;
    try {
      if (contact.type === "TELEGRAM") {
        await sendTelegramMessage(contact.value, `${subject}\n\n${text}`);
      } else {
        await sendMail({ to: contact.value, subject, text });
      }
      if (monitor) {
        await prisma.alert.create({
          data: {
            monitorId: monitor.id,
            contactId: contact.id,
            kind: "DOMAIN",
            message: `${subject} — ${detail}`,
          },
        });
      }
    } catch (err) {
      console.error(`[Logsy] Не удалось отправить DOMAIN-алерт на ${contact.value}:`, err);
    }
  }
}

/** Проверяет срок регистрации одного проекта, обновляет поля и шлёт предупреждения. */
export async function checkProjectDomain(project: ProjectDomainRow): Promise<void> {
  const info = await checkDomainRegistration(project.domain);
  const status = domainStatusFromDays(info.ok, info.daysLeft);

  // Порог оповещения по фактическому остатку в днях.
  let nextAlertDays = project.domainAlertDays;
  if (info.ok && info.daysLeft !== null) {
    const level = currentAlertLevel(info.daysLeft);
    if (level === null) {
      // До окончания больше 30 дней — сбрасываем историю, чтобы при следующем
      // цикле (напр. после продления) пороги снова сработали.
      nextAlertDays = null;
    } else if (project.domainAlertDays === null || level < project.domainAlertDays) {
      // Достигнут более срочный порог, чем оповещённый ранее — шлём письмо.
      await notifyProjectDomain(project, level, info);
      nextAlertDays = level;
    }
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      domainStatus: status,
      domainExpiresAt: info.expiresAt,
      domainDaysLeft: info.daysLeft,
      domainRegistrar: info.registrar,
      domainCheckedAt: new Date(),
      domainAlertDays: nextAlertDays,
    },
  });
}

/**
 * Обходит проекты с включённой проверкой домена и активной подпиской, проверяет
 * те, которым подошёл срок. Проекты с выключенной проверкой помечает OFF.
 */
export async function runDueProjectDomainChecks(now: Date): Promise<number> {
  const projects = await prisma.project.findMany({
    include: { user: { select: { role: true } } },
  });

  let checked = 0;
  await Promise.all(
    projects.map(async (p) => {
      // Проверка выключена — фиксируем OFF и очищаем данные один раз.
      if (!p.checkDomain) {
        if (p.domainStatus !== "OFF") {
          await prisma.project.update({
            where: { id: p.id },
            data: {
              domainStatus: "OFF",
              domainExpiresAt: null,
              domainDaysLeft: null,
              domainRegistrar: null,
              domainCheckedAt: null,
              domainAlertDays: null,
            },
          });
        }
        return;
      }
      if (!isProjectServiceActive(p, p.user.role === "ADMIN", now)) return;
      if (!isDomainCheckDue(p, now)) return;
      checked += 1;
      await checkProjectDomain(p).catch((e) =>
        console.error(`[Logsy] Ошибка проверки домена проекта ${p.id}:`, e),
      );
    }),
  );
  return checked;
}
