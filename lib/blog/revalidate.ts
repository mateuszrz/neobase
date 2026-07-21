/**
 * Which ISR paths an article write invalidates.
 *
 * The public blog routes are `revalidate = 3600`, so without an explicit purge
 * a freshly published post is invisible on the index for up to an hour — and
 * the sitemap, which is also ISR, keeps omitting it for just as long. That
 * second one was the easy miss: the editor purged the two blog paths and left
 * the sitemap stale, so a new post could sit unlisted for crawlers even though
 * it looked published to a human.
 *
 * Defined once so the editor's server action and the publish script cannot
 * drift apart on what "publishing" has to invalidate.
 */

import { routing } from "@/i18n/routing";

export function articlePaths(locale: string, slug: string): string[] {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return [`${prefix}/blog`, `${prefix}/blog/${slug}`, "/sitemap.xml"];
}

/**
 * Purge those paths. Must be called from a request scope — a server action or
 * a route handler — because `revalidatePath` is a no-op outside one. Standalone
 * scripts should POST to /api/revalidate instead of importing this.
 */
export async function revalidateArticle(locale: string, slug: string): Promise<string[]> {
  const { revalidatePath } = await import("next/cache");
  const paths = articlePaths(locale, slug);
  for (const p of paths) revalidatePath(p);
  return paths;
}
