// Next.js instrumentation hook. Выполняется один раз при старте сервера.
// Здесь поднимается планировщик мониторинга: он живёт внутри процесса Next.js
// и каждую минуту проверяет мониторы, которым подошёл срок.
//
// Важно: register() вызывается и в edge-, и в nodejs-рантайме. Планировщик и
// Prisma работают только в Node.js, поэтому импортируем их динамически и лишь
// под соответствующей проверкой рантайма — иначе edge-бандл упадёт.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Планировщик не должен ронять старт сервера: любые ошибки (недоступна БД и
  // т.п.) только логируем. Первый прогон запускаем без await (fire-and-forget),
  // чтобы сервер поднимался мгновенно и отвечал на запросы сразу.
  try {
    const { startScheduler } = await import("@/lib/scheduler");
    const { runDueChecks } = await import("@/lib/checker");
    const { startTelegramPolling } = await import("@/lib/telegram");

    startScheduler();
    startTelegramPolling();
    runDueChecks().catch((e) => console.error("[Logsy] Первый прогон:", e));
  } catch (e) {
    console.error("[Logsy] Не удалось запустить планировщик:", e);
  }
}
