/**
 * Processes one `collect_social` job: pull the Apify dataset for a finished
 * LinkedIn/Facebook run, normalise the posts, and idempotently upsert them into
 * social_posts. The profile then shows real posts instead of the sample preview.
 */

import { listDatasetPage } from "@/lib/apify";
import { normalizeSocialPost, upsertSocialPost } from "./apify";
import type { SocialNetwork } from "./sample";

export interface SocialPayload {
  fintechId: string;
  network: SocialNetwork;
  datasetId: string;
}

export interface SocialResult {
  upserted: number;
}

export async function processSocialDataset(p: SocialPayload): Promise<SocialResult> {
  const items = await listDatasetPage(p.datasetId, 0, 24);
  let upserted = 0;
  for (const [i, raw] of items.entries()) {
    const post = normalizeSocialPost(raw, i);
    if (!post.text) continue;
    await upsertSocialPost(p.fintechId, p.network, post, raw);
    upserted++;
  }
  return { upserted };
}
