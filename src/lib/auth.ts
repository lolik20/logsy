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

      return { id: user.id, email: user.email, name: user.name };
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

      return { id: user.id, email: user.email, name: user.name };
    },
  }),
];

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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
