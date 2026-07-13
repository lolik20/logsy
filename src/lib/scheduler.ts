import cron from "node-cron";
import { runDueChecks } from "@/lib/checker";
import { purgeExpiredLogs } from "@/lib/logging";

let started = false;

/**
 * Запускает планировщик:
 *  - каждую минуту прогоняет мониторы, которым пора;
 *  - каждый час чистит логи, вышедшие за срок хранения тарифа.
 */
export function startScheduler(): void {
  if (started) return;
  started = true;

  console.log("[Logsy] Планировщик запущен: проверки каждую минуту (* * * * *)");

  cron.schedule("* * * * *", async () => {
    try {
      const count = await runDueChecks();
      if (count > 0) {
        console.log(`[Logsy] Проверено мониторов: ${count} (${new Date().toISOString()})`);
      }
    } catch (err) {
      console.error("[Logsy] Ошибка прогона проверок:", err);
    }
  });

  // Ретеншн логов: раз в час удаляем события старше срока хранения тарифа.
  cron.schedule("15 * * * *", async () => {
    try {
      const { deletedEvents } = await purgeExpiredLogs();
      if (deletedEvents > 0) {
        console.log(`[Logsy] Очистка логов: удалено событий ${deletedEvents}`);
      }
    } catch (err) {
      console.error("[Logsy] Ошибка очистки логов:", err);
    }
  });
}
