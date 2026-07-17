/**
 * Live ingest of third-party MENTIONS via Apify search actors.
 *
 * Searches each network (X / LinkedIn / Facebook) for public posts ABOUT a brand
 * (by name / @handle) and upserts them into `mentions`. Distinct from the social
 * pipeline (which pulls the brand's OWN posts from its page).
 *
 * Dormant until the network's search-actor env is set — the profile renders
 * sample mentions until then. Actor payloads vary, so the input builder branches
 * per network and the normaliser reads several common field names defensively.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { apify } from "@/lib/apify";
import { env } from "@/lib/env";
import { judgeRelevant } from "./relevance";
import type { MentionNetwork } from "./sample";

const { fintechs, mentions } = schema;

/** Drop off-topic rows via the relevance gate, then upsert the rest. Returns kept count. */
async function upsertRelevant(fintechId: string, network: MentionNetwork, brand: string, rows: NormalizedMention[], raws: unknown[]): Promise<number> {
  const withText = rows.map((m, i) => ({ m, raw: raws[i] })).filter(({ m }) => m.text);
  const keep = await judgeRelevant(brand, withText.map(({ m }) => m.text as string));
  let upserted = 0;
  for (let i = 0; i < withText.length; i++) {
    if (!keep[i]) continue;
    await upsertMention(fintechId, network, withText[i].m, withText[i].raw);
    upserted++;
  }
  return upserted;
}

export const MENTION_NETWORKS: MentionNetwork[] = ["x", "facebook", "reddit"];

/** Apify search actor for a network. Reddit uses a free RSS feed (no actor). */
export function mentionActorFor(network: MentionNetwork): string {
  return network === "x" ? env.APIFY_X_SEARCH_ACTOR : network === "facebook" ? env.APIFY_FACEBOOK_SEARCH_ACTOR : "";
}

function num(v: unknown): number | null {
  if (v == null || typeof v === "object") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function firstNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

/** Extract the brand's own @handle for a network from fintechs.socials (X uses twitter). */
function handleFrom(socials: unknown, network: MentionNetwork): string | null {
  if (!socials || typeof socials !== "object") return null;
  const s = socials as Record<string, unknown>;
  const key = network === "x" ? "twitter" : network; // socials store X under "twitter"
  const v = s[key] ?? s[`${key}Url`];
  if (typeof v !== "string" || !v.trim()) return null;
  const m = v.match(/(?:x\.com|twitter\.com|linkedin\.com\/company|facebook\.com)\/@?([A-Za-z0-9_.-]+)/i);
  return m ? m[1] : null;
}

/**
 * Search query for third-party mentions. On X we prefer the brand's @handle
 * (precise); elsewhere the brand name. Common-word names (Wise, Curve…) are
 * noisy — disambiguation/relevance filtering is applied downstream (sentiment
 * classifier can drop off-topic rows); refine per-brand as needed.
 */
export function mentionQuery(name: string, network: MentionNetwork, handle: string | null): string {
  if (network === "x" && handle) return `@${handle}`;
  return `"${name}"`;
}

/** Apify actor input, branched per network — matches the shipped actors (verified
 *  2026-07-17): X apidojo/tweet-scraper, Facebook scrapeforge/facebook-search-posts.
 *  (Reddit uses RSS, not an actor.) Revisit if you swap actors. */
export function searchInput(network: MentionNetwork, query: string, maxItems = 25): Record<string, unknown> {
  if (network === "x") return { searchTerms: [query], maxItems: Math.max(maxItems, 50), sort: "Latest", tweetLanguage: "en" };
  // facebook: scrapeforge/facebook-search-posts — single query string, post search
  return { query, search_type: "posts", max_results: maxItems };
}

export interface NormalizedMention {
  externalId: string;
  url: string | null;
  authorName: string | null;
  authorHandle: string | null;
  postedAt: Date | null;
  text: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export function normalizeMention(item: Record<string, any>, i: number): NormalizedMention {
  const author = item.author && typeof item.author === "object" ? item.author : {};
  const user = item.user && typeof item.user === "object" ? item.user : {};
  const eng = item.engagement && typeof item.engagement === "object" ? item.engagement : {};
  const text = item.text ?? item.content ?? item.message ?? item.postText ?? item.full_text ?? null;
  const url = item.url ?? item.postUrl ?? item.link ?? item.tweetUrl ?? item.linkedinUrl ?? item.permalink ?? null;
  const rawDate =
    item.createdAt ?? item.date ?? item.time ?? item.timestamp ?? item.publishedAt ?? item.postedAt ??
    (item.postedAt && typeof item.postedAt === "object" ? item.postedAt.date ?? item.postedAt.timestamp : null) ??
    null;
  const posted = rawDate != null && typeof rawDate !== "object" ? new Date(rawDate) : null;
  const authorName = author.name ?? author.fullName ?? user.name ?? item.authorName ?? item.userName ?? item.username ?? null;
  const authorHandle = author.userName ?? author.screen_name ?? user.username ?? item.screenName ?? item.handle ?? null;
  return {
    externalId: String(item.id ?? item.tweetId ?? item.postId ?? item.urn ?? url ?? `idx-${i}`),
    url: typeof url === "string" ? url : null,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    text: typeof text === "string" ? text : null,
    authorName: typeof authorName === "string" ? authorName : null,
    authorHandle: typeof authorHandle === "string" ? authorHandle.replace(/^@/, "") : null,
    likes: firstNum(eng.likes, item.likeCount, item.likes, item.favoriteCount, item.reactions, item.numLikes),
    comments: firstNum(eng.comments, item.replyCount, item.comments, item.commentsCount, item.numComments),
    shares: firstNum(eng.shares, item.retweetCount, item.shares, item.reposts, item.sharesCount),
  };
}

/** Idempotent upsert of one normalised mention (natural key: fintech+network+externalId). */
export async function upsertMention(
  fintechId: string,
  network: MentionNetwork,
  m: NormalizedMention,
  raw: unknown,
): Promise<void> {
  await db
    .insert(mentions)
    .values({
      fintechId,
      network,
      externalId: m.externalId,
      url: m.url,
      authorName: m.authorName,
      authorHandle: m.authorHandle,
      postedAt: m.postedAt,
      text: m.text,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      raw: raw as any,
    })
    .onConflictDoUpdate({
      target: [mentions.fintechId, mentions.network, mentions.externalId],
      set: {
        text: m.text, url: m.url, authorName: m.authorName, authorHandle: m.authorHandle,
        postedAt: m.postedAt, likes: m.likes, comments: m.comments, shares: m.shares, raw: raw as any,
      },
    });
}

// ─── Reddit (free RSS, no Apify) ────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#x27;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&"); // last, so &amp;lt; → &lt; → < isn't double-decoded
}
function xmlTag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : null;
}

/** Parse Reddit's Atom search feed into normalised mentions. */
function parseRedditFeed(xml: string): NormalizedMention[] {
  const out: NormalizedMention[] = [];
  const entries = xml.split(/<entry>/i).slice(1).map((s) => s.split(/<\/entry>/i)[0]);
  for (const [i, e] of entries.entries()) {
    const title = xmlTag(e, "title");
    const author = xmlTag(e, "name"); // <author><name>/u/user</name>
    const published = xmlTag(e, "published") ?? xmlTag(e, "updated");
    const href = e.match(/<link[^>]*href="([^"]+)"/i)?.[1] ?? null;
    const id = xmlTag(e, "id");
    if (!title) continue;
    const handle = author ? author.replace(/^\/?u\//, "") : null;
    const posted = published ? new Date(published) : null;
    out.push({
      externalId: id ?? href ?? `reddit-${i}`,
      url: href,
      authorName: handle ? `u/${handle}` : null,
      authorHandle: handle,
      postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
      // The post title is the mention — clean and reliable (the RSS <content> is
      // a messy "submitted by …" boilerplate blob, so we skip it).
      text: decodeEntities(title),
      likes: null,
      comments: null,
      shares: null,
    });
  }
  return out;
}

async function ingestReddit(fintechId: string, name: string, _limit: number): Promise<number> {
  // Fetch a wider net (25, newest) and let the relevance gate cut the noise —
  // brand-name search on Reddit is noisy ("Revolut" vs "revolution").
  const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(`"${name}"`)}&sort=new&limit=25`;
  const res = await fetch(url, { headers: { "user-agent": "neobase-mentions/1.0 (+https://neobase.co)" } });
  if (!res.ok) throw new Error(`reddit ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const rows = parseRedditFeed(await res.text());
  return upsertRelevant(fintechId, "reddit", name, rows, rows.map(() => ({ source: "reddit-rss" })));
}

/**
 * Synchronous single-brand mention ingest for one network (waits for the run).
 * For the weekly job at scale, mirror the async social webhook path instead.
 */
export async function ingestMentions(fintechId: string, network: MentionNetwork, limit = 12): Promise<number> {
  const [ft] = await db.select({ name: fintechs.name, socials: fintechs.socials }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!ft) throw new Error(`no such fintech: ${fintechId}`);

  if (network === "reddit") return ingestReddit(fintechId, ft.name, limit);

  const actor = mentionActorFor(network);
  if (!actor) return 0; // dormant — no search actor configured for this network
  const query = mentionQuery(ft.name, network, handleFrom(ft.socials, network));

  const client = apify();
  const run = await client.actor(actor).call(searchInput(network, query, limit), { waitSecs: 180 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit, clean: true });

  const raws = items as Record<string, any>[];
  const rows = raws.map((raw, i) => normalizeMention(raw, i));
  return upsertRelevant(fintechId, network, ft.name, rows, raws);
}
