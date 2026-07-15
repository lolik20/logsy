import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage } from "@/lib/telegram";
import { isProjectServiceActive } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

type ContactRow = { id: string; type: string; value: string; verified: boolean };

type ProjectExpiryRow = {
  id: string;
  name: string;
  billingStatus: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  expiryAlertSentFor: Date | null;
  user: {
    id: string;
    role: string;
    contacts: ContactRow[];
  };
};

/** Дата окончания оплаченного периода проекта. */
function periodEndOf(p: ProjectExpiryRow): Date | null {
  return p.currentPeriodEnd;
}

/**
 * Отправляет напоминание о скором окончании тарифа проекта на все контакты
 * пользователя и записывает алерты в историю (если у проекта есть монитор).
 */
async function notifyExpiry(project: ProjectExpiryRow, end: Date): Promise<void> {
  const contacts = project.user.contacts;
  if (contacts.length === 0) return;

  const when = end.toLocaleString("ru-RU");
  const label = "Тариф";
  const subject = `⚠️ ${label} Logsy по проекту «${project.name}» истекает завтра`;
  const text =
    `${label} по проекту «${project.name}» истекает ${when} — меньше чем через сутки.\n` +
    `После окончания мониторинг и логирование проекта будут остановлены.\n` +
    `Продлите тариф во вкладке «Тариф» проекта, чтобы сервис не прерывался.\n` +
    `Время напоминания: ${new Date().toLocaleString("ru-RU")}\n`;

  // Алерт в истории требует monitorId и contactId. Привязываем к первому монитору
  // проекта; если мониторов нет — оповещение всё равно уходит, просто без записи.
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
            kind: "SUBSCRIPTION",
            message: `${subject} — истекает ${when}`,
          },
        });
      }
    } catch (err) {
      console.error(
        `[Logsy] Не удалось отправить напоминание о тарифе на ${contact.value}:`,
        err,
      );
    }
  }
}

/**
 * Обходит проекты, которым осталось меньше суток до окончания оплаченного тарифа,
 * и один раз за период шлёт напоминание по всем контактам владельца. Проекты
 * администраторов (безлимит) и неактивные пропускает.
 */
export async function runDueSubscriptionExpiryChecks(now: Date): Promise<number> {
  const soon = new Date(now.getTime() + DAY_MS);

  const projects = (await prisma.project.findMany({
    where: {
      billingStatus: "ACTIVE",
      currentPeriodEnd: { gt: now, lte: soon },
    },
    select: {
      id: true,
      name: true,
      billingStatus: true,
      currentPeriodEnd: true,
      trialEndsAt: true,
      expiryAlertSentFor: true,
      user: {
        select: {
          id: true,
          role: true,
          contacts: { select: { id: true, type: true, value: true, verified: true } },
        },
      },
    },
  })) as ProjectExpiryRow[];

  let notified = 0;
  await Promise.all(
    projects.map(async (project) => {
      const end = periodEndOf(project);
      if (!end) return;
      // Безлимитный тариф администратора не истекает — пропускаем.
      if (project.user.role === "ADMIN") return;
      // Только для реально активного тарифа/триала.
      if (!isProjectServiceActive(project, false, now)) return;
      // За этот период уже предупреждали — второй раз не шлём.
      if (project.expiryAlertSentFor && project.expiryAlertSentFor.getTime() === end.getTime())
        return;
      // Нет контактов — отправлять некуда.
      if (project.user.contacts.length === 0) return;

      notified += 1;
      await notifyExpiry(project, end).catch((e) =>
        console.error(`[Logsy] Ошибка напоминания о тарифе проекта ${project.id}:`, e),
      );
      await prisma.project.update({
        where: { id: project.id },
        data: { expiryAlertSentFor: end },
      });
    }),
  );

  return notified;
}
