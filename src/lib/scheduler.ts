import cron from "node-cron";
import { runDueChecks } from "@/lib/checker";

let started = false;

/** Запускает планировщик: каждую минуту прогоняет мониторы, которым пора. */
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
}
