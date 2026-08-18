// Рендер посадочной страницы из описания контента (см. src/lib/seo/types.ts).
//
// Одна разметка на все страницы первой волны: заголовок под запрос, ввод с ответом
// сразу, блоки разбора, FAQ и один простой CTA. Плюс микроразметка: FAQPage и
// BreadcrumbList — по ним Яндекс и Google показывают вопросы прямо в выдаче.

import Link from "next/link";
import { auth } from "@/lib/auth";
import { LandingNav } from "@/components/LandingNav";
import { LandingFooter } from "@/components/LandingFooter";
import type { SeoPageContent } from "@/lib/seo/types";
import { EXTERNAL_TITLES, getSeoPage, pageExists } from "@/lib/seo/registry";
import { appUrl } from "@/lib/api-docs";

/** Заголовок соседней страницы для перелинковки: берём из её же описания. */
function relatedTitle(url: string): string {
  return getSeoPage(url)?.h1 ?? EXTERNAL_TITLES[url] ?? url;
}

export async function SeoPage({ content }: { content: SeoPageContent }) {
  const session = await auth();
  const base = appUrl();
  const ctaHref = content.cta.href ?? "/register";
  const ctaLabel = content.cta.label ?? "Подключить бесплатно";
  // Соседние страницы могут быть ещё не написаны — в перелинковку идут только живые.
  const related = content.related.filter(pageExists);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Logsy", item: base },
        ...(content.breadcrumb
          ? [{ "@type": "ListItem", position: 2, name: content.breadcrumb.title, item: `${base}${content.breadcrumb.href}` }]
          : []),
        {
          "@type": "ListItem",
          position: content.breadcrumb ? 3 : 2,
          name: content.h1,
          item: `${base}${content.url}`,
        },
      ],
    },
    ...(content.faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: content.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen">
      <LandingNav authed={!!session} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        {/* Хлебные крошки */}
        <nav className="text-sm text-slate-500">
          <Link href="/" className="hover:text-brand">
            Logsy
          </Link>
          {content.breadcrumb && (
            <>
              {" / "}
              <Link href={content.breadcrumb.href} className="hover:text-brand">
                {content.breadcrumb.title}
              </Link>
            </>
          )}
        </nav>

        <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">{content.h1}</h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">{content.lead}</p>

        {/* Простой CTA сразу после ввода — читателю в аварии некогда листать */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={ctaHref}
            className="rounded-xl bg-gradient-to-r from-brand to-brand-light px-5 py-2.5 font-semibold text-white shadow-card transition-transform hover:-translate-y-0.5"
          >
            {ctaLabel}
          </Link>
          {content.cta.note && <span className="text-sm text-slate-500">{content.cta.note}</span>}
        </div>

        {/* Блоки разбора */}
        <div className="mt-10 space-y-8">
          {content.sections.map((s) => (
            <section key={s.title}>
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.body && <p className="mt-2 text-slate-600 dark:text-slate-300">{s.body}</p>}
              {s.bullets && (
                <ul className="mt-3 space-y-2">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-2 text-slate-600 dark:text-slate-300">
                      <span className="mt-1 text-brand">→</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}
              {s.code && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-4 text-sm text-slate-100">
                  <code>{s.code}</code>
                </pre>
              )}
              {s.table && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="bg-slate-50 text-left text-slate-500 dark:bg-slate-900">
                      <tr>
                        {s.table.head.map((h, i) => (
                          <th
                            key={h}
                            className={`px-4 py-2 font-medium ${i === s.table!.head.length - 1 ? "text-brand" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.rows.map((row) => (
                        <tr key={row[0]} className="border-t border-slate-100 dark:border-slate-800">
                          {row.map((cell, i) => (
                            <td
                              key={i}
                              className={`px-4 py-2 align-top ${
                                i === 0
                                  ? "font-medium text-slate-700 dark:text-slate-200"
                                  : i === row.length - 1
                                    ? "text-slate-700 dark:text-slate-200"
                                    : "text-slate-500"
                              }`}
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {s.note && <p className="mt-3 text-sm text-slate-500">{s.note}</p>}
            </section>
          ))}
        </div>

        {/* FAQ — он же микроразметка под расширенный сниппет */}
        {content.faq.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xl font-semibold">Частые вопросы</h2>
            <div className="mt-4 space-y-3">
              {content.faq.map((f) => (
                <details
                  key={f.q}
                  className="group rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <summary className="cursor-pointer list-none font-medium marker:hidden">
                    <span className="mr-2 text-brand transition-transform group-open:rotate-90 inline-block">›</span>
                    {f.q}
                  </summary>
                  <p className="mt-2 pl-5 text-slate-600 dark:text-slate-300">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Итоговый CTA */}
        <section className="mt-12 rounded-2xl bg-brand-50 p-6 dark:bg-brand/10">
          <h2 className="text-lg font-semibold">{content.cta.title}</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-300">{content.cta.text}</p>
          <Link
            href={ctaHref}
            className="mt-4 inline-block rounded-xl bg-gradient-to-r from-brand to-brand-light px-5 py-2.5 font-semibold text-white"
          >
            {ctaLabel}
          </Link>
          {content.cta.note && (
            <p className="mt-3 text-sm text-slate-500">{content.cta.note}</p>
          )}
        </section>

        {/* Перелинковка */}
        {related.length > 0 && (
          <nav className="mt-12 border-t border-slate-200 pt-6 dark:border-slate-800">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Читайте дальше
            </h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {related.map((url) => (
                <li key={url}>
                  <Link
                    href={url}
                    className="block rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-brand hover:text-brand dark:border-slate-800 dark:text-slate-300"
                  >
                    {relatedTitle(url)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>

      <LandingFooter />
    </main>
  );
}
