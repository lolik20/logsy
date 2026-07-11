// Next.js instrumentation hook. Выполняется один раз при старте сервера.
// Здесь поднимается планировщик мониторинга: он живёт внутри процесса Next.js
// и каждую минуту проверяет мониторы, которым подошёл срок.
//
// Важно: register() вызывается и в edge-, и в nodejs-рантайме. Планировщик и
// Prisma работают только в Node.js, поэтому импортируем их динамически и лишь
// под соответствующей проверкой рантайма — иначе edge-бандл упадёт.
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startScheduler } = await import("@/lib/scheduler");
  const { runDueChecks } = await import("@/lib/checker");

  // Прогон сразу при старте, затем — каждую минуту по расписанию.
  await runDueChecks().catch((e) => console.error("[Logsy] Первый прогон:", e));
  startScheduler();
}
