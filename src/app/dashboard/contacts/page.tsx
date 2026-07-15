import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/session";
import { getBotLink } from "@/lib/telegram";
import { ContactManager } from "@/components/ContactManager";
import { Faq } from "@/components/Faq";

export const dynamic = "force-dynamic";

const alertsFaq = [
  {
    q: "Как добавить email для уведомлений?",
    a: "В блоке «Email» введите адрес и нажмите «Добавить». На него будут приходить письма, когда монитор упадёт или восстановится.",
  },
  {
    q: "Как подключить Telegram?",
    a: "Нажмите «Открыть бота», запустите его кнопкой «Запустить» — бот пришлёт ваш chat id. Скопируйте его в поле «Chat id» и нажмите «Добавить».",
  },
  {
    q: "Как удалить канал?",
    a: 'В списке «Подключённые каналы» нажмите кнопку «Удалить» напротив нужного канала.',
  },
  {
    q: "Когда приходят алерты?",
    a: "Когда монитор становится недоступен или восстанавливается, а также при приближении окончания срока SSL-сертификата.",
  },
];

export default async function ContactsPage() {
  const userId = (await getUserId())!;
  const contacts = await prisma.contact.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const botLink = await getBotLink();

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
          botLink={botLink}
          contacts={contacts.map((c) => ({
            id: c.id,
            type: c.type,
            value: c.value,
            verified: c.verified,
          }))}
        />
      </div>

      <div className="mt-8">
        <Faq items={alertsFaq} />
      </div>
    </div>
  );
}
