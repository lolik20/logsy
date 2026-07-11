import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
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
      <h1 className="text-2xl font-bold">Контакты для алертов</h1>
      <p className="mt-1 text-sm text-slate-500">
        На эти адреса приходят письма, когда мониторы падают или
        восстанавливаются.
      </p>

      <div className="mt-6">
        <ContactManager
          contacts={contacts.map((c) => ({ id: c.id, value: c.value }))}
        />
      </div>
    </div>
  );
}
