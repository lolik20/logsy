import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Yandex from "next-auth/providers/yandex";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { consumeQuickAuthToken } from "@/lib/quick-auth";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Почта и пароль",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Пароль", type: "password" },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || "")
        .trim()
        .toLowerCase();
      const password = String(credentials?.password || "");
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) return null;

      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  }),
  // Быстрая авторизация по одноразовой ссылке из письма (без ввода пароля).
  Credentials({
    id: "quick-link",
    name: "Ссылка из письма",
    credentials: {
      token: { label: "Token", type: "text" },
    },
    async authorize(credentials) {
      const token = String(credentials?.token || "");
      const email = await consumeQuickAuthToken(token);
      if (!email) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) return null;

      return { id: user.id, email: user.email, name: user.name, role: user.role };
    },
  }),
];

// Email-адреса, которым при входе автоматически выдаётся роль ADMIN.
// Задаётся через переменную окружения ADMIN_EMAILS (список через запятую).
// Удобно для «загрузки» первого администратора без ручного изменения БД.
const adminEmails = new Set(
  (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/**
 * Возвращает актуальную роль пользователя. Если email указан в ADMIN_EMAILS,
 * а в БД роль ещё не ADMIN — повышает её (одноразово при входе).
 */
async function resolveRole(
  userId: string,
  email: string | null | undefined,
  currentRole: string | null | undefined,
): Promise<string> {
  const role = currentRole ?? "USER";
  if (email && adminEmails.has(email.toLowerCase()) && role !== "ADMIN") {
    await prisma.user
      .update({ where: { id: userId }, data: { role: "ADMIN" } })
      .catch(() => null);
    return "ADMIN";
  }
  return role;
}

// Yandex ID подключается только если заданы креды приложения.
export const yandexEnabled = Boolean(
  process.env.AUTH_YANDEX_ID && process.env.AUTH_YANDEX_SECRET,
);

if (yandexEnabled) {
  providers.push(
    Yandex({
      clientId: process.env.AUTH_YANDEX_ID,
      clientSecret: process.env.AUTH_YANDEX_SECRET,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = await resolveRole(user.id!, user.email, user.role);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
