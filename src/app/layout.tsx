import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  // Базовый адрес нужен, чтобы относительные canonical и Open Graph на посадочных
  // страницах разворачивались в абсолютные ссылки.
  metadataBase: new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || "https://logsy.ru"),
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
    <html lang="ru" className={inter.variable}>
      <body className="font-sans">
        <Providers>{children}</Providers>
        {/* Logsy self-logging SDK — сервис логирует сам себя.
            Проект определяется по Origin запроса, поэтому домен Logsy
            должен быть заведён как проект в самом сервисе. */}
        <Script src="/api/logger/sdk" strategy="afterInteractive" />
        {/* Yandex.Metrika counter */}
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){
                m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();
                for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
                k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
            })(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=110628862', 'ym');

            ym(110628862, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
          `}
        </Script>
        <noscript>
          <div>
            <img
              src="https://mc.yandex.ru/watch/110628862"
              style={{ position: "absolute", left: "-9999px" }}
              alt=""
            />
          </div>
        </noscript>
        {/* /Yandex.Metrika counter */}
      </body>
    </html>
  );
}
