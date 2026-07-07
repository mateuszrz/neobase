/**
 * Thin Anthropic client wrapper. Mirrors lib/apify's mock/live split: when
 * ANTHROPIC_API_KEY is absent the crawl pipeline runs against deterministic
 * fixtures and never calls out, so the whole flow is testable offline.
 *
 * Claude is used ONLY to reason over already-fetched page text (extract the
 * canonical {plans, prices, features} structure and summarise week-over-week
 * changes) — it never fetches anything from the internet itself.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export function anthropic(): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
}

/** True when a real key is configured; otherwise callers use their mock path. */
export const isClaudeLive = () => Boolean(env.ANTHROPIC_API_KEY);

/** Model id for crawl extraction/diff (env-overridable — see lib/env). */
export const crawlModel = () => env.ANTHROPIC_CRAWL_MODEL;
