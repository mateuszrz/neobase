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
import type { MentionNetwork } from "./sample";

const { fintechs, mentions } = schema;

export const MENTION_NETWORKS: MentionNetwork[] = ["x", "linkedin", "facebook"];

export function mentionActorFor(network: MentionNetwork): string {
  return network === "x"
    ? env.APIFY_X_SEARCH_ACTOR
    : network === "linkedin"
      ? env.APIFY_LINKEDIN_SEARCH_ACTOR
      : env.APIFY_FACEBOOK_SEARCH_ACTOR;
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

/** Actor input, branched per network — matches the shipped actors (verified 2026-07-17):
 *  X apidojo/tweet-scraper, LinkedIn harvestapi/linkedin-post-search, Facebook
 *  scrapeforge/facebook-search-posts. Revisit if you swap actors. */
export function searchInput(network: MentionNetwork, query: string, maxItems = 25): Record<string, unknown> {
  if (network === "x") return { searchTerms: [query], maxItems: Math.max(maxItems, 50), sort: "Latest", tweetLanguage: "en" };
  if (network === "linkedin") return { searchQueries: [query], maxPosts: maxItems, postedLimit: "month", sortBy: "date" };
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

/**
 * Synchronous single-brand mention ingest for one network (waits for the run).
 * For the weekly job at scale, mirror the async social webhook path instead.
 */
export async function ingestMentions(fintechId: string, network: MentionNetwork, limit = 12): Promise<number> {
  const actor = mentionActorFor(network);
  if (!actor) return 0; // dormant — no search actor configured for this network

  const [ft] = await db.select({ name: fintechs.name, socials: fintechs.socials }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!ft) throw new Error(`no such fintech: ${fintechId}`);
  const query = mentionQuery(ft.name, network, handleFrom(ft.socials, network));

  const client = apify();
  const run = await client.actor(actor).call(searchInput(network, query, limit), { waitSecs: 180 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit, clean: true });

  let upserted = 0;
  for (const [i, raw] of (items as Record<string, any>[]).entries()) {
    const m = normalizeMention(raw, i);
    if (!m.text) continue;
    await upsertMention(fintechId, network, m, raw);
    upserted++;
  }
  return upserted;
}
