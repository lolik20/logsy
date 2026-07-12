// Компактная «подпись» состояния мониторов — строка, которая меняется, когда
// у любого монитора изменился статус или время последней проверки.
// Считается одинаково на сервере (при рендере страницы) и в API-эндпоинте,
// чтобы клиент мог сравнить их и обновить панель только при реальном изменении.

export type MonitorStatus = {
  id: string;
  lastStatus: string;
  lastCheckedAt: Date | string | null;
};

export function statusSignature(monitors: MonitorStatus[]): string {
  return [...monitors]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((m) => {
      const checked = m.lastCheckedAt
        ? new Date(m.lastCheckedAt).getTime()
        : 0;
      return `${m.id}:${m.lastStatus}:${checked}`;
    })
    .join("|");
}
