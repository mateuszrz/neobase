import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Inter, Inter_Tight } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { Nav, Footer } from "@/components/ui";
import { routing } from "@/i18n/routing";
import { env } from "@/lib/env";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const interTight = Inter_Tight({
  subsets: ["latin", "latin-ext"], // latin-ext covers Polish diacritics (ą ć ę ł ń ó ś ź ż)
  weight: ["400", "500"],
  variable: "--font-roobert",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site" });
  return {
    // Prod serves www; the apex only 308s to it. Pointing metadataBase at the
    // apex would make every canonical and hreflang target a redirect.
    metadataBase: new URL(env.APP_BASE_URL),
    title: { default: t("title"), template: t("titleTemplate") },
    description: t("description"),
    // Non-English locales are noindex until their CONTENT is translated, not
    // just their chrome — right now /pl/ is a Polish shell around English
    // copy, which is exactly the thin duplicate search engines penalise.
    // Remove this once scripts/translate-content.ts has run for the locale.
    //
    // Deliberately a meta tag and NOT a robots.txt Disallow: a disallowed page
    // is never fetched, so the noindex would never be read, and the URL could
    // still surface from external links.
    ...(locale === routing.defaultLocale ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Opts these pages into static rendering — without it every page under
  // [locale] becomes dynamic and we lose the ISR the directory relies on.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${inter.variable} ${interTight.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Nav />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
