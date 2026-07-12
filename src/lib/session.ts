import { auth } from "@/lib/auth";

/** Возвращает id текущего пользователя или null, если не авторизован. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Роль текущего пользователя ("USER" | "ADMIN") или null, если не авторизован. */
export async function getUserRole(): Promise<string | null> {
  const session = await auth();
  return session?.user?.role ?? null;
}

/** Является ли текущий пользователь администратором. */
export async function isAdmin(): Promise<boolean> {
  return (await getUserRole()) === "ADMIN";
}
