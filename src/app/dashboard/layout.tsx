import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const admin = session.user.role === "ADMIN";

  // Проекты пользователя — для двухуровневого меню (проект → сервис).
  const projects = session.user.id
    ? await prisma.project.findMany({
        where: { userId: session.user.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      })
    : [];

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar
        email={session.user.email ?? ""}
        projects={projects}
        isAdmin={admin}
      />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-5xl px-4 pb-8 pt-20 sm:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
