/**
 * Data access for our own editorial articles (the `articles` table).
 *
 * Not to be confused with lib/blog/ingest.ts, which handles `blog_posts` —
 * crawled third-party newsroom content belonging to tracked fintechs.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { articles } = schema;

export interface ArticleListItem {
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: Date | null;
  tags: string[] | null;
}

/** Published articles for a locale, newest first. */
export async function listArticles(locale: string, limit?: number): Promise<ArticleListItem[]> {
  const rows = await db
    .select({
      slug: articles.slug,
      title: articles.title,
      excerpt: articles.excerpt,
      coverUrl: articles.coverUrl,
      publishedAt: articles.publishedAt,
      tags: articles.tags,
    })
    .from(articles)
    .where(and(eq(articles.locale, locale), eq(articles.status, "published")))
    .orderBy(desc(articles.publishedAt))
    .limit(limit ?? 500);
  return rows;
}

/** A single published article. Drafts are invisible to the public routes. */
export async function getArticle(locale: string, slug: string) {
  const [row] = await db
    .select()
    .from(articles)
    .where(and(eq(articles.locale, locale), eq(articles.slug, slug), eq(articles.status, "published")))
    .limit(1);
  return row ?? null;
}

/** Every article in a locale, drafts included — editor only. */
export async function listAllArticles() {
  return db
    .select({
      id: articles.id,
      locale: articles.locale,
      slug: articles.slug,
      title: articles.title,
      status: articles.status,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .orderBy(desc(articles.updatedAt));
}

export async function getArticleById(id: number) {
  const [row] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return row ?? null;
}

/** All published (locale, slug) pairs — for generateStaticParams and the sitemap. */
export async function allPublishedArticleParams(): Promise<{ locale: string; slug: string }[]> {
  const rows = await db
    .select({ locale: articles.locale, slug: articles.slug })
    .from(articles)
    .where(eq(articles.status, "published"));
  return rows;
}

/**
 * URL-safe slug that keeps non-ASCII letters readable.
 *
 * Polish titles must not collapse to gibberish, so accented letters are folded
 * to their base form (ł→l, ż→z) rather than stripped: "Najlepsze giełdy" →
 * "najlepsze-gieldy", not "najlepsze-gie-dy".
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ł/g, "l") // not covered by NFKD decomposition
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Reading time in minutes, floored at 1. */
export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export async function articleCounts() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${articles.status} = 'published')::int`,
    })
    .from(articles);
  return row ?? { total: 0, published: 0 };
}
