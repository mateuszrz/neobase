/**
 * Live social ingest via Apify. Resolves a fintech's LinkedIn/Facebook handle
 * from `fintechs.socials`, runs the configured actor, normalises the posts, and
 * upserts them into social_posts.
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

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function actorFor(network: SocialNetwork): string {
  return network === "linkedin" ? env.APIFY_LINKEDIN_ACTOR : env.APIFY_FACEBOOK_ACTOR;
}

/** Read a network handle/URL from fintechs.socials (shape varies by seed). */
function handleFrom(socials: unknown, network: SocialNetwork): string | null {
  if (!socials || typeof socials !== "object") return null;
  const s = socials as Record<string, unknown>;
  const v = s[network] ?? s[`${network}Url`] ?? s[`${network}_url`];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

interface NormalizedPost {
  externalId: string;
  url: string | null;
  postedAt: Date | null;
  text: string | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
}

function normalize(item: Record<string, any>, i: number): NormalizedPost {
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

export async function ingestSocial(fintechId: string, network: SocialNetwork, limit = 12): Promise<number> {
  const actor = actorFor(network);
  if (!actor) throw new Error(`no Apify actor configured for ${network} (set APIFY_${network.toUpperCase()}_ACTOR)`);

  const [ft] = await db.select({ socials: fintechs.socials }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  const handle = handleFrom(ft?.socials, network);
  if (!handle) throw new Error(`no ${network} handle in fintechs.socials for "${fintechId}"`);

  const client = apify();
  const run = await client.actor(actor).call({ startUrls: [{ url: handle }], maxPosts: limit }, { waitSecs: 180 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit, clean: true });

  let upserted = 0;
  for (const [i, raw] of (items as Record<string, any>[]).entries()) {
    const p = normalize(raw, i);
    if (!p.text) continue;
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
        raw,
      })
      .onConflictDoUpdate({
        target: [socialPosts.fintechId, socialPosts.network, socialPosts.externalId],
        set: { text: p.text, likes: p.likes, comments: p.comments, shares: p.shares, url: p.url, postedAt: p.postedAt, raw },
      });
    upserted++;
  }
  return upserted;
}
