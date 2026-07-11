import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Logsy — мониторинг доступности сайтов",
  description:
    "Сервис мониторинга uptime для российского рынка. Следите за доступностью сайтов и получайте алерты на почту.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
