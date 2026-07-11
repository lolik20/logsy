import { auth } from "@/lib/auth";

/** Возвращает id текущего пользователя или null, если не авторизован. */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
