import type { MetadataRoute } from "next";
import { listNeobanks, listExchanges } from "@/lib/queries";
import { featuredPairs } from "@/lib/compare";
import { allPublishedArticleParams } from "@/lib/blog/articles";
import { INDEXABLE_LOCALES } from "@/i18n/routing";
import { localePath } from "@/lib/i18n/alternates";
import { TAGS } from "@/lib/tags";
import { env } from "@/lib/env";

export const revalidate = 3600;

const base = () => env.APP_BASE_URL.replace(/\/$/, "");

/**
 * One entry per (path, locale), each carrying the full `alternates.languages`
 * set so search engines see the versions as one page in several languages
 * rather than as duplicates.
 *
 * Locales that are still noindexed are deliberately EXCLUDED — listing a URL
 * in the sitemap while telling crawlers not to index it is a contradiction.
 * They appear here automatically once the noindex in app/[locale]/layout.tsx
 * is lifted for them.
 */


function entries(paths: string[], priority: number, changeFrequency: "daily" | "weekly"): MetadataRoute.Sitemap {
  const b = base();
  const now = new Date();
  return paths.flatMap((path) =>
    INDEXABLE_LOCALES.map((locale) => ({
      url: `${b}${localePath(locale, path)}`,
      lastModified: now,
      changeFrequency,
      priority: path === "/" ? 1 : priority,
      alternates: {
        languages: Object.fromEntries(INDEXABLE_LOCALES.map((l) => [l, `${b}${localePath(l, path)}`])),
      },
    })),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static routes, including the ones this file used to omit: /best/,
  // /exchanges/mica/ and the blog.
  const staticPaths = ["/", "/neobanks/", "/exchanges/", "/exchanges/mica/", "/best/", "/compare/", "/blog/", "/about/", "/monitoring/", "/terms/", "/privacy/"];
  const staticRoutes = entries(staticPaths, 0.7, "weekly");
  const rankings = entries(TAGS.map((t) => `/best/${t.slug}/`), 0.6, "weekly");

  try {
    const [neobanks, exchanges, articles, pairs] = await Promise.all([listNeobanks(), listExchanges(), allPublishedArticleParams(), featuredPairs()]);
    const profiles = entries(
      [...neobanks.map((f) => `/fintech/${f.id}/`), ...exchanges.map((f) => `/exchange/${f.id}/`)],
      0.6,
      "daily",
    );
    // Curated head of "X vs Y" comparison pages; the long tail is indexable too
    // (rendered on-demand) but kept out of the sitemap to bound its size.
    const comparisons = entries(pairs.map((p) => `/compare/${p.pair}/`), 0.5, "weekly");
    // Articles are per-locale by nature — a Polish post has no English twin —
    // so they're listed individually rather than through entries().
    const b = base();
    const posts: MetadataRoute.Sitemap = articles
      .filter((a) => (INDEXABLE_LOCALES as string[]).includes(a.locale))
      .map((a) => ({
        url: `${b}${localePath(a.locale, `/blog/${a.slug}/`)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.6,
      }));
    return [...staticRoutes, ...rankings, ...profiles, ...comparisons, ...posts];
  } catch {
    // DB unreachable — still serve the static routes rather than 500.
    return [...staticRoutes, ...rankings];
  }
}
