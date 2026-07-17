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

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  return { startUrls: [{ url: handle }], resultsLimit: maxPosts };
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
  const text = item.text ?? item.content ?? item.postText ?? item.message ?? null;
  const url = item.url ?? item.postUrl ?? item.link ?? null;
  const dateStr = item.date ?? item.postedAt ?? item.time ?? item.timestamp ?? null;
  const posted = dateStr ? new Date(dateStr) : null;
  return {
    externalId: String(item.id ?? item.postId ?? item.urn ?? url ?? `idx-${i}`),
    url: typeof url === "string" ? url : null,
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    text: typeof text === "string" ? text : null,
    likes: num(item.likes ?? item.reactions ?? item.numLikes ?? item.likesCount),
    comments: num(item.comments ?? item.numComments ?? item.commentsCount),
    shares: num(item.shares ?? item.reposts ?? item.numShares ?? item.sharesCount),
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
