import { getLocale } from "next-intl/server";
import { redirect as intlRedirect } from "@/i18n/navigation";

/**
 * Locale-preserving `redirect()`.
 *
 * The bare `next/navigation` redirect sends a Polish reader to the English
 * page: `/pl/panel/` → `/login`. It also drops the trailing slash, costing an
 * extra 308 under `trailingSlash: true`. next-intl's redirect needs the locale
 * passed explicitly (it can't be inferred inside a server action), so this
 * resolves it once and forwards.
 *
 * Pass hrefs WITH a trailing slash, as everywhere else in the app.
 */
export async function localeRedirect(href: string): Promise<never> {
  return intlRedirect({ href, locale: await getLocale() });
}
