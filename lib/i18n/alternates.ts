import type { Metadata } from "next";
import { routing, INDEXABLE_LOCALES } from "@/i18n/routing";

/**
 * hreflang + canonical for a page, given its locale-independent path.
 *
 * Every public page needs the same shape, and getting it wrong is expensive:
 * a canonical that points at a redirect, or an alternate that omits x-default,
 * quietly wastes the crawl. Centralised so it's defined once.
 *
 * Paths must start and end with "/" — trailingSlash: true means /best is a 308
 * to /best/, so emitting the unslashed form points search engines at a
 * redirect rather than the page.
 */
export function localePath(locale: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return locale === routing.defaultLocale ? p : `/${locale}${p}`;
}

export function alternates(locale: string, path: string): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  // Only indexable locales get an hreflang entry. Advertising a noindexed
  // translation as an alternate contradicts the noindex on that page.
  for (const l of INDEXABLE_LOCALES) languages[l] = localePath(l, path);
  // x-default points at the unprefixed English URL — the version to serve a
  // reader whose language we don't publish.
  languages["x-default"] = localePath(routing.defaultLocale, path);
  return { canonical: localePath(locale, path), languages };
}
