// Реестр посадочных страниц: адрес → содержимое.
//
// Один источник для маршрутов, метаданных, перелинковки и карты сайта. Страницы,
// которых ещё нет, из блока «Читайте дальше» отфильтровываются — так карта может
// опережать реализацию, а посетитель не упирается в 404.

import type { SeoPageContent } from "@/lib/seo/types";
import { ERROR_PAGES } from "@/content/seo/errors";
import { HELP_PAGES } from "@/content/seo/help";
import { TOOL_PAGES } from "@/content/seo/tools";
import { SOLUTION_PAGES } from "@/content/seo/solutions";
import { MISC_PAGES } from "@/content/seo/misc";
import { WEBVISOR_PAGES } from "@/content/seo/webvisor";

export const SEO_PAGES: SeoPageContent[] = [
  ...SOLUTION_PAGES,
  ...ERROR_PAGES,
  ...HELP_PAGES,
  ...TOOL_PAGES,
  ...MISC_PAGES,
  ...WEBVISOR_PAGES,
];

/**
 * Страницы, написанные отдельно (не через этот движок), но пригодные для перелинковки.
 * Заголовки нужны, чтобы блок «Читайте дальше» не показывал голые адреса.
 */
export const EXTERNAL_TITLES: Record<string, string> = {
  "/": "Мониторинг сайта 24/7: узнаете о падении раньше клиентов",
  "/for-owners": "Мониторинг сайта для владельцев бизнеса",
  "/for-marketers": "Мониторинг лендингов для маркетологов",
  "/for-developers": "Логи и запись сессий для разработчиков",
  "/speed-test": "Проверить скорость загрузки сайта онлайн",
  "/site-check": "Проверить сайт онлайн бесплатно",
  "/docs/api": "Документация публичного API",
  "/docs/for-agents": "Ошибки прода для ИИ-агента",
  "/register": "Подключить сайт",
  "/offer": "Публичная оферта",
  "/privacy": "Политика конфиденциальности",
};

export const EXTERNAL_PAGES = new Set(Object.keys(EXTERNAL_TITLES));

const BY_URL = new Map(SEO_PAGES.map((p) => [p.url, p]));

export function getSeoPage(url: string): SeoPageContent | undefined {
  return BY_URL.get(url);
}

/** Есть ли по адресу реальная страница — для фильтрации перелинковки. */
export function pageExists(url: string): boolean {
  return BY_URL.has(url) || EXTERNAL_PAGES.has(url);
}

/** Содержимое по префиксу и слагу: getByPath("/errors", "500"). */
export function getByPath(prefix: string, slug: string): SeoPageContent | undefined {
  return BY_URL.get(`${prefix}/${slug}`);
}

/** Слаги внутри раздела — для generateStaticParams и проверок. */
export function slugsUnder(prefix: string): string[] {
  return SEO_PAGES.filter((p) => p.url.startsWith(`${prefix}/`)).map((p) =>
    p.url.slice(prefix.length + 1),
  );
}
