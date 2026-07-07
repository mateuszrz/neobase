/**
 * Page fetch layer for the crawl engine.
 *
 * Strategy: a free server-side `fetch()` first (covers most SSR marketing/home
 * pages), and only when that comes back empty or bot-blocked do we fall back to
 * the Apify website-content-crawler (headless render + anti-bot + proxies). This
 * keeps cost near zero — we pay Apify only for pages the free path can't get.
 *
 * Claude is never involved here; this module only retrieves text.
 */

import { apify } from "@/lib/apify";
import { isApifyLive } from "@/lib/env";
import { env } from "@/lib/env";

export type FetchVia = "fetch" | "apify";

export interface FetchedPage {
  status: number | null;
  title: string | null;
  text: string;
  via: FetchVia;
}

/** Minimum plausible content length; below this we treat a fetch as failed. */
const MIN_TEXT = 250;
const FETCH_TIMEOUT_MS = 15_000;
const UA =
  "Mozilla/5.0 (compatible; NeoBaseBot/1.0; +https://neobase.co/robots)";

/** Strip a raw HTML document down to visible text + <title>. */
export function htmlToText(html: string): { title: string | null; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : null;

  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|section|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n")
    .trim();

  return { title, text };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

async function directFetch(url: string): Promise<FetchedPage | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return { status: res.status, title: null, text: "", via: "fetch" };
    const html = await res.text();
    const { title, text } = htmlToText(html);
    return { status: res.status, title, text, via: "fetch" };
  } catch {
    return null; // network error / timeout — treat as a miss, try Apify
  } finally {
    clearTimeout(timer);
  }
}

/** Apify website-content-crawler for one page: rendered, anti-bot, clean text. */
async function apifyFetch(url: string): Promise<FetchedPage | null> {
  const client = apify();
  const run = await client.actor(env.APIFY_CRAWLER_ACTOR).call(
    {
      startUrls: [{ url }],
      maxCrawlDepth: 0,
      maxCrawlPages: 1,
      crawlerType: "playwright:adaptive",
      saveMarkdown: true,
    },
    { waitSecs: 120 },
  );
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1, clean: true });
  const item = items[0] as Record<string, any> | undefined;
  if (!item) return null;
  const text = String(item.text ?? item.markdown ?? "").trim();
  const title = typeof item.metadata?.title === "string" ? item.metadata.title : (item.title ?? null);
  return { status: 200, title, text, via: "apify" };
}

/** True when a direct fetch didn't yield usable content (empty / blocked). */
function isMiss(p: FetchedPage | null): boolean {
  return !p || p.text.length < MIN_TEXT || (p.status != null && p.status >= 400);
}

/**
 * Fetch a page's text, escalating to Apify only when the free path misses.
 * Throws if neither path produces usable content (job retries via the queue).
 */
export async function fetchPage(url: string): Promise<FetchedPage> {
  const direct = await directFetch(url);
  if (!isMiss(direct)) return direct!;

  if (isApifyLive()) {
    const viaApify = await apifyFetch(url);
    if (!isMiss(viaApify)) return viaApify!;
  }

  // Nothing usable. Surface the best signal we have.
  if (direct) return direct; // carries the HTTP status for diagnostics
  throw new Error(`fetch failed for ${url} (direct network error, no Apify fallback)`);
}
