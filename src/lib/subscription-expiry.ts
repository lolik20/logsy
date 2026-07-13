import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sendTelegramMessage } from "@/lib/telegram";
import { isSubscriptionActive } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

type ContactRow = { id: string; type: string; value: string };

type SubscriptionExpiryRow = {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: Date | null;
  expiryAlertSentFor: Date | null;
  user: {
    id: string;
    role: string;
    contacts: ContactRow[];
  };
};

/** Человекочитаемое название плана для темы/текста письма. */
function planPhrase(plan: string): string {
  return plan === "TRIAL" ? "Пробный период" : "Подписка";
}

/**
 * Отправляет напоминание о скором окончании подписки на все контакты
 * пользователя и записывает алерты в историю (если у пользователя есть монитор).
 */
async function notifyExpiry(sub: SubscriptionExpiryRow, end: Date): Promise<void> {
  const contacts = sub.user.contacts;
  if (contacts.length === 0) return;

  const when = end.toLocaleString("ru-RU");
  const label = planPhrase(sub.plan);
  const subject = `⚠️ ${label} Logsy истекает завтра`;
  const text =
    `${label} истекает ${when} — меньше чем через сутки.\n` +
    `После окончания мониторинг ваших сайтов будет остановлен.\n` +
    `Продлите подписку на вкладке «Тарифы», чтобы проверки не прерывались.\n` +
    `Время напоминания: ${new Date().toLocaleString("ru-RU")}\n`;

  // Алерт в истории требует monitorId и contactId. Привязываем к первому монитору
  // пользователя; если мониторов ещё нет — оповещение всё равно уходит, просто
  // без записи в истории.
  const monitor = await prisma.monitor.findFirst({
    where: { project: { userId: sub.user.id } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  for (const contact of contacts) {
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
        `[Logsy] Не удалось отправить напоминание о подписке на ${contact.value}:`,
        err,
      );
    }
  }
}

/**
 * Обходит подписки, которым осталось меньше суток до окончания, и один раз за
 * период шлёт напоминание по всем контактам пользователя. Администраторов
 * (безлимитная подписка) и неактивные подписки пропускает.
 */
export async function runDueSubscriptionExpiryChecks(now: Date): Promise<number> {
  const soon = new Date(now.getTime() + DAY_MS);

  const subs = await prisma.subscription.findMany({
    where: {
      currentPeriodEnd: { gt: now, lte: soon },
    },
    include: {
      user: {
        select: {
          id: true,
          role: true,
          contacts: { select: { id: true, type: true, value: true } },
        },
      },
    },
  });

  let notified = 0;
  await Promise.all(
    subs.map(async (sub) => {
      const end = sub.currentPeriodEnd;
      if (!end) return;
      // Безлимитная подписка администратора не истекает — пропускаем.
      if (sub.user.role === "ADMIN") return;
      // Только для реально активной подписки (TRIAL в срок / PAID со статусом active).
      if (!isSubscriptionActive(sub, now)) return;
      // За этот период уже предупреждали — второй раз не шлём.
      if (sub.expiryAlertSentFor && sub.expiryAlertSentFor.getTime() === end.getTime())
        return;
      // Нет контактов — отправлять некуда, отметку не ставим (вдруг добавит позже).
      if (sub.user.contacts.length === 0) return;

      notified += 1;
      await notifyExpiry(sub, end).catch((e) =>
        console.error(`[Logsy] Ошибка напоминания о подписке ${sub.id}:`, e),
      );
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { expiryAlertSentFor: end },
      });
    }),
  );

  return notified;
}
