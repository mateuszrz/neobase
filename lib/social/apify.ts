/**
 * Live social ingest via Apify. Resolves a fintech's LinkedIn/Facebook handle
 * from `fintechs.socials`, runs the configured actor, normalises the posts, and
 * upserts them into social_posts.
 *
 * Two entry points share the normalise + upsert helpers:
 *  - `ingestSocial` — synchronous (waits for the run); used by the social:test
 *    script for one-off single-fintech runs.
 *  - the webhook path (lib/social/kickoff → /api/webhooks/apify → collect_social
 *    job → lib/social/process) — async, for the weekly public kickoff at scale.
 *
 * Wired but dormant until APIFY_LINKEDIN_ACTOR / APIFY_FACEBOOK_ACTOR are set —
 * the public page renders sample posts until then. Actor payloads vary, so the
 * normaliser reads from several common field names defensively.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { apify } from "@/lib/apify";
import { env } from "@/lib/env";
import type { SocialNetwork } from "./sample";

const { fintechs, socialPosts } = schema;

/** source.kind ↔ network for the two social scrapers. */
export const SOCIAL_KINDS: Record<string, SocialNetwork> = {
  social_linkedin: "linkedin",
  social_facebook: "facebook",
};
export const isSocialKind = (kind: string): boolean => kind in SOCIAL_KINDS;
export const networkOf = (kind: string): SocialNetwork | null => SOCIAL_KINDS[kind] ?? null;
export const kindFor = (network: SocialNetwork): string => `social_${network}`;

/** Coerce a scalar to a count. Arrays/objects (e.g. LinkedIn's top-level `reactions: []`,
 *  which `Number()` would silently turn into 0) are rejected so they don't mask the real
 *  nested `engagement.*` counts. */
function num(v: unknown): number | null {
  if (v == null || typeof v === "object") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** First value in the list that coerces to a real count (skips arrays/objects/NaN). */
function firstNum(...vals: unknown[]): number | null {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return null;
}

export function actorFor(network: SocialNetwork): string {
  return network === "linkedin" ? env.APIFY_LINKEDIN_ACTOR : env.APIFY_FACEBOOK_ACTOR;
}

/** Read a network handle/URL from fintechs.socials (shape varies by seed). */
export function handleFrom(socials: unknown, network: SocialNetwork): string | null {
  if (!socials || typeof socials !== "object") return null;
  const s = socials as Record<string, unknown>;
  const v = s[network] ?? s[`${network}Url`] ?? s[`${network}_url`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/**
 * Actor input for a handle — shape is actor-specific, so we branch per network to
 * match the two actors we ship with. Swapping actors means revisiting this:
 *  - LinkedIn: harvestapi/linkedin-profile-posts — `targetUrls: string[]` + `maxPosts`,
 *    no cookies/login (handles /company/… and /in/… URLs).
 *  - Facebook: apify/facebook-posts-scraper — `startUrls: [{url}]` + `resultsLimit`.
 */
export function socialInput(network: SocialNetwork, handle: string, maxPosts = 12): Record<string, unknown> {
  if (network === "linkedin") return { targetUrls: [handle], maxPosts };
  // Facebook: Meta blocks datacenter proxies (empty datasets / not_available),
  // so the FB actor needs residential proxy to return posts.
  return {
    startUrls: [{ url: handle }],
    resultsLimit: maxPosts,
    proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
  };
}

export interface NormalizedPost {
  externalId: string;
  url: string | null;
  postedAt: Date | null;
  text: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

export function normalizeSocialPost(item: Record<string, any>, i: number): NormalizedPost {
  // Some actors (harvestapi LinkedIn) nest engagement counts under `engagement` and
  // return the post date as an object `{date, timestamp, …}` rather than a string.
  const eng = item.engagement && typeof item.engagement === "object" ? item.engagement : {};
  const text = item.text ?? item.content ?? item.postText ?? item.message ?? null;
  const url = item.url ?? item.postUrl ?? item.link ?? item.linkedinUrl ?? item.shareLinkedinUrl ?? item.permalink ?? null;
  const rawDate =
    item.date ?? item.time ?? item.timestamp ?? item.publishedAt ??
    (item.postedAt && typeof item.postedAt === "object" ? item.postedAt.date ?? item.postedAt.timestamp : item.postedAt) ??
    null;
  const posted = rawDate != null ? new Date(rawDate) : null;
  return {
    externalId: String(item.id ?? item.postId ?? item.urn ?? item.shareUrn ?? url ?? `idx-${i}`),
    url: typeof url === "string" ? url : null,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    text: typeof text === "string" ? text : null,
    // Prefer nested engagement.* (LinkedIn); fall back to flat fields (Facebook).
    likes: firstNum(eng.likes, eng.reactions, item.likes, item.numLikes, item.likesCount),
    comments: firstNum(eng.comments, item.numComments, item.commentsCount, item.comments),
    shares: firstNum(eng.shares, item.shares, item.reposts, item.numShares, item.sharesCount),
  };
}

/** Idempotent upsert of one normalised post (natural key: fintech+network+externalId). */
export async function upsertSocialPost(
  fintechId: string,
  network: SocialNetwork,
  p: NormalizedPost,
  raw: unknown,
): Promise<void> {
  await db
    .insert(socialPosts)
    .values({
      fintechId,
      network,
      externalId: p.externalId,
      url: p.url,
      postedAt: p.postedAt,
      text: p.text,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      raw: raw as any,
    })
    .onConflictDoUpdate({
      target: [socialPosts.fintechId, socialPosts.network, socialPosts.externalId],
      set: { text: p.text, likes: p.likes, comments: p.comments, shares: p.shares, url: p.url, postedAt: p.postedAt, raw: raw as any },
    });
}

/**
 * Synchronous single-fintech ingest (waits for the run). For the weekly job at
 * scale use the async webhook path instead — Apify runs take minutes.
 */
export async function ingestSocial(fintechId: string, network: SocialNetwork, limit = 12): Promise<number> {
  const actor = actorFor(network);
  if (!actor) throw new Error(`no Apify actor configured for ${network} (set APIFY_${network.toUpperCase()}_ACTOR)`);

  const [ft] = await db.select({ socials: fintechs.socials }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  const handle = handleFrom(ft?.socials, network);
  if (!handle) throw new Error(`no ${network} handle in fintechs.socials for "${fintechId}"`);

  const client = apify();
  const run = await client.actor(actor).call(socialInput(network, handle, limit), { waitSecs: 180 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit, clean: true });

  let upserted = 0;
  for (const [i, raw] of (items as Record<string, any>[]).entries()) {
    const p = normalizeSocialPost(raw, i);
    if (!p.text) continue;
    await upsertSocialPost(fintechId, network, p, raw);
    upserted++;
  }
  return upserted;
}
