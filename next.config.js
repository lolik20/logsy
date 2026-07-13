/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Включает хук инструментации (src/instrumentation.ts), в котором стартует
  // планировщик мониторинга. В Next.js 15 стабилен и флаг не нужен.
  experimental: {
    instrumentationHook: true,
    // Держим node-only пакеты внешними в серверном бандле.
    serverComponentsExternalPackages: ["node-cron", "nodemailer", "@prisma/client", "undici"],
  },
  webpack: (config, { nextRuntime }) => {
    // instrumentation.ts компилируется и для edge-рантайма, куда по графу
    // dynamic import попадают node-cron/nodemailer/prisma со встроенными
    // модулями Node. Реально этот код на edge не выполняется (register()
    // выходит, если NEXT_RUNTIME !== "nodejs"), поэтому для edge-сборки
    // сводим эти встроенные модули к пустышкам.
    if (nextRuntime === "edge") {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        stream: false,
        path: false,
        os: false,
        crypto: false,
        zlib: false,
        http: false,
        https: false,
      };
      // undici (используется в @/lib/telegram для прокси) тянет node:dns и на
      // edge не работает. Реально этот код на edge не выполняется — сводим
      // пакет к пустышке, чтобы edge-бандл не падал на node:-схемах.
      config.resolve.alias = {
        ...config.resolve.alias,
        undici: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
