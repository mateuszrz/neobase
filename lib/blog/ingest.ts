/**
 * Blog post ingest: fetch a fintech's blog page (reusing the crawl fetch layer —
 * free direct fetch first, Apify only on miss), extract the recent-post list via
 * Claude, and upsert into blog_posts. Called from the crawl `blog` branch and the
 * blog:test script.
 *
 * Blog extraction needs Claude, so in mock / no-key mode it skips (no fake rows —
 * the profile keeps rendering the deterministic sample).
 */

import { db, schema } from "@/lib/db";
import { isClaudeLive } from "@/lib/anthropic";
import { fetchPage } from "@/lib/crawl/fetch";
import { extractBlogPosts } from "./extract";

const { blogPosts } = schema;

function parseDate(raw: string | null): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Best-effort blog URL from a fintech website (website + /blog). */
export function blogUrlFor(website: string | null): string | null {
  if (!website) return null;
  const base = website.trim().replace(/\/+$/, "");
  if (!base) return null;
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`;
  return `${withScheme}/blog`;
}

export interface BlogIngestResult {
  upserted: number;
  via: string;
}

/** Fetch + extract + upsert blog posts for one fintech from a blog URL. */
export async function ingestBlogPage(
  fintechId: string,
  url: string,
  opts: { mock?: boolean } = {},
): Promise<BlogIngestResult> {
  if (opts.mock || !isClaudeLive()) return { upserted: 0, via: "skipped" };

  // Direct fetch only — a guessed /blog URL that misses isn't worth a 120s Apify run.
  const page = await fetchPage(url, { directOnly: true });
  if (!page.text || page.text.length < 200) return { upserted: 0, via: page.via };

  const posts = await extractBlogPosts(page.text, url);
  let upserted = 0;
  for (const p of posts) {
    if (!p.title?.trim()) continue;
    const externalId = (p.url ?? p.title).slice(0, 500);
    await db
      .insert(blogPosts)
      .values({
        fintechId,
        externalId,
        url: p.url,
        title: p.title.trim(),
        publishedAt: parseDate(p.date),
        snippet: p.snippet,
        raw: p as any,
      })
      .onConflictDoUpdate({
        target: [blogPosts.fintechId, blogPosts.externalId],
        set: { title: p.title.trim(), url: p.url, publishedAt: parseDate(p.date), snippet: p.snippet, raw: p as any },
      });
    upserted++;
  }
  return { upserted, via: page.via };
}
