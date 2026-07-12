import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { describeSubscription } from "@/lib/subscription";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sub = session.user.id
    ? await prisma.subscription.findUnique({ where: { userId: session.user.id } })
    : null;
  const subscription = describeSubscription(sub);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        email={session.user.email ?? ""}
        subscription={subscription}
        isAdmin={session.user.role === "ADMIN"}
      />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
