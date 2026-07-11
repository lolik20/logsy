// Точка входа фонового воркера Logsy.
// Запуск: npm run worker
// Держит процесс живым и каждую минуту проверяет мониторы, которым подошёл срок.
import { startScheduler } from "@/lib/scheduler";
import { runDueChecks } from "@/lib/checker";

async function main() {
  console.log("[Logsy] Воркер мониторинга стартует…");
  // Прогон сразу при старте, затем по расписанию.
  await runDueChecks().catch((e) => console.error(e));
  startScheduler();
}

main().catch((err) => {
  console.error("[Logsy] Фатальная ошибка воркера:", err);
  process.exit(1);
});
