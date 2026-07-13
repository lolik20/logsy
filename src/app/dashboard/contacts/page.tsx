import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { getBotLink } from "@/lib/telegram";
import { ContactManager } from "@/components/ContactManager";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const userId = (await getUserId())!;
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Алерты</h1>
      <p className="mt-1 text-sm text-slate-500">
        Каналы, куда приходят уведомления, когда мониторы падают или
        восстанавливаются, а также предупреждения об истечении SSL. Добавьте
        email или подключите Telegram.
      </p>

      <div className="mt-6">
        <ContactManager
          botLink={getBotLink()}
          contacts={contacts.map((c) => ({
            id: c.id,
            type: c.type,
            value: c.value,
          }))}
        />
      </div>
    </div>
  );
}
