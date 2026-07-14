import { redirect } from "next/navigation";

// Тарификация переехала на уровень проекта (вкладка «Тариф» внутри проекта).
// Старый общий раздел «Тарифы» больше не используется — ведём на список проектов.
export default function BillingPage() {
  redirect("/dashboard");
}
