import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { isSubscriptionActive } from "@/lib/subscription";
import { checkSslCertificate, sslStatusFromDays, SslInfo } from "@/lib/ssl";

const HOUR_MS = 60 * 60 * 1000;

// Пороги предупреждений в часах (по убыванию срочности): за неделю, за 3 дня,
// за 1 день и за 1 час до истечения. Значение 0 отвечает за «сертификат истёк».
// Каждое предупреждение отправляется один раз — см. Project.sslAlertHours.
const ALERT_THRESHOLDS_H = [7 * 24, 3 * 24, 24, 1];

type ProjectSslRow = {
  id: string;
  userId: string;
  name: string;
  domain: string;
  checkSsl: boolean;
  sslStatus: string;
  sslDaysLeft: number | null;
  sslCheckedAt: Date | null;
  sslAlertHours: number | null;
};

/**
 * Как часто перепроверять сертификат. Чем ближе к истечению, тем чаще — чтобы
 * не пропустить пороги «за 1 день» и «за 1 час».
 */
function checkIntervalMs(daysLeft: number | null): number {
  if (daysLeft == null) return 6 * HOUR_MS; // ещё не знаем — попробуем через 6 ч
  if (daysLeft > 7) return 12 * HOUR_MS;
  if (daysLeft > 1) return HOUR_MS; // последняя неделя — раз в час
  return 10 * 60 * 1000; // меньше суток — каждые 10 минут (поймать пороги 1д/1ч)
}

function isSslCheckDue(project: ProjectSslRow, now: Date): boolean {
  if (!project.sslCheckedAt) return true;
  return now.getTime() - project.sslCheckedAt.getTime() >= checkIntervalMs(project.sslDaysLeft);
}

/**
 * Самый срочный (наименьший) достигнутый порог предупреждения в часах:
 * 168 | 72 | 24 | 1, либо 0 если сертификат уже истёк, либо null если до
 * истечения ещё больше недели.
 */
function currentAlertLevel(hoursLeft: number): number | null {
  if (hoursLeft <= 0) return 0;
  let level: number | null = null;
  for (const t of ALERT_THRESHOLDS_H) {
    if (hoursLeft <= t && (level === null || t < level)) level = t;
  }
  return level;
}

/** Человекочитаемое описание порога для темы/текста письма. */
function levelPhrase(level: number): string {
  switch (level) {
    case 0:
      return "истёк";
    case 1:
      return "истекает менее чем через час";
    case 24:
      return "истекает менее чем через 1 день";
    case 72:
      return "истекает менее чем через 3 дня";
    case 168:
      return "истекает менее чем через неделю";
    default:
      return "скоро истекает";
  }
}

async function notifyProjectSsl(
  project: ProjectSslRow,
  level: number,
  info: SslInfo,
): Promise<void> {
  const contacts = await prisma.contact.findMany({
    where: { userId: project.userId, type: "EMAIL" },
  });
  if (contacts.length === 0) return;

  const expired = level === 0;
  const when = info.validTo ? info.validTo.toLocaleString("ru-RU") : "неизвестно";
  const phrase = levelPhrase(level);
  const subject = expired
    ? `🔴 SSL-сертификат сайта ${project.domain} истёк`
    : `⚠️ SSL-сертификат сайта ${project.domain} ${phrase}`;
  const detail = expired
    ? `Сертификат для ${project.domain} истёк ${when}.`
    : `Сертификат для ${project.domain} ${phrase} — действует до ${when}.`;
  const text =
    `Проект: ${project.name}\n` +
    `Домен: ${project.domain}\n` +
    `${detail}\n` +
    (info.issuer ? `Издатель: ${info.issuer}\n` : "") +
    `Время проверки: ${new Date().toLocaleString("ru-RU")}\n`;

  // SSL-алерты привязываем к первому монитору проекта (schema Alert требует
  // monitorId и contactId). Если мониторов ещё нет — письмо всё равно уходит,
  // просто без записи в истории алертов.
  const monitor = await prisma.monitor.findFirst({
    where: { projectId: project.id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const contact of contacts) {
    try {
      await sendMail({ to: contact.value, subject, text });
      if (monitor) {
        await prisma.alert.create({
          data: {
            monitorId: monitor.id,
            contactId: contact.id,
            kind: "SSL",
            message: `${subject} — ${detail}`,
          },
        });
      }
    } catch (err) {
      console.error(`[Logsy] Не удалось отправить SSL-алерт на ${contact.value}:`, err);
    }
  }
}

/** Проверяет сертификат одного проекта, обновляет поля и шлёт предупреждения. */
export async function checkProjectSsl(project: ProjectSslRow): Promise<void> {
  const info = await checkSslCertificate(`https://${project.domain}`, null);
  const status = sslStatusFromDays(info.ok, info.daysLeft);

  // Порог оповещения по фактическому остатку в часах.
  let nextAlertHours = project.sslAlertHours;
  if (info.ok && info.validTo) {
    const hoursLeft = (info.validTo.getTime() - Date.now()) / HOUR_MS;
    const level = currentAlertLevel(hoursLeft);
    if (level === null) {
      // До истечения больше недели — сбрасываем историю, чтобы при следующем
      // цикле (напр. после продления) пороги снова сработали.
      nextAlertHours = null;
    } else if (project.sslAlertHours === null || level < project.sslAlertHours) {
      // Достигнут более срочный порог, чем оповещённый ранее — шлём письмо.
      await notifyProjectSsl(project, level, info);
      nextAlertHours = level;
    }
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      sslStatus: status,
      sslExpiresAt: info.validTo,
      sslDaysLeft: info.daysLeft,
      sslIssuer: info.issuer,
      sslCheckedAt: new Date(),
      sslAlertHours: nextAlertHours,
    },
  });
}

/**
 * Обходит проекты с включённой проверкой SSL и активной подпиской, проверяет
 * те, которым подошёл срок. Проекты с выключенной проверкой помечает OFF.
 */
export async function runDueProjectSslChecks(now: Date): Promise<number> {
  const projects = await prisma.project.findMany({
    include: { user: { select: { subscription: true } } },
  });

  let checked = 0;
  await Promise.all(
    projects.map(async (p) => {
      // Проверка выключена — фиксируем OFF и очищаем данные один раз.
      if (!p.checkSsl) {
        if (p.sslStatus !== "OFF") {
          await prisma.project.update({
            where: { id: p.id },
            data: {
              sslStatus: "OFF",
              sslExpiresAt: null,
              sslDaysLeft: null,
              sslIssuer: null,
              sslCheckedAt: null,
              sslAlertHours: null,
            },
          });
        }
        return;
      }
      if (!isSubscriptionActive(p.user.subscription, now)) return;
      if (!isSslCheckDue(p, now)) return;
      checked += 1;
      await checkProjectSsl(p).catch((e) =>
        console.error(`[Logsy] Ошибка проверки SSL проекта ${p.id}:`, e),
      );
    }),
  );
  return checked;
}
