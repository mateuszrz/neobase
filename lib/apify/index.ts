/**
 * Thin Apify wrapper. Only used when APIFY_TOKEN + actor are configured;
 * otherwise the pipeline runs against the deterministic mock and never calls out.
 */

import { ApifyClient } from "apify-client";
import { env } from "@/lib/env";

export function apify(): ApifyClient {
  return new ApifyClient({ token: env.APIFY_TOKEN });
}

// ─── Per-kind actor inputs ───────────────────────────────────────────────────
// Every builder targets ONLY the newest data (a small window), never full
// history: reviews dedupe on upsert and re-scraping lifetime volume daily is
// wasteful. Each run also carries the store/company aggregate (rating + total
// count) so the daily metric_snapshots point is self-contained.

/**
 * Daily Trustpilot input: newest reviews (recency-sorted lookback) +
 * `includeCompanyInfo` for the current TrustScore + lifetime review count.
 */
export function trustpilotDailyInput(domain: string, _storeCountry?: string): Record<string, unknown> {
  return {
    companyDomain: domain,
    mode: "reviews",
    sort: "recency",
    lookbackDays: 3,
    maxResults: 500, // safety cap; a lookback window rarely exceeds this
    includeCompanyInfo: true,
    skipReposts: true,
  };
}

/**
 * Google Play: `details` mode returns the app aggregate (score, total ratings,
 * 1–5★ histogram) in a single item — rating, volume AND sentiment all come from
 * the store listing, so we never scrape individual reviews here.
 */
export function googlePlayDailyInput(appId: string, storeCountry = "us"): Record<string, unknown> {
  return { mode: "details", appIds: [appId], country: storeCountry.toLowerCase(), language: "en" };
}

/**
 * App Store: `details` gives the app aggregate (rating, ratingCount) but no
 * histogram, so we ride newest reviews along (`includeReviews`) to derive recent
 * sentiment. Small sample — enough for a sentiment share, cheap.
 */
export function appStoreDailyInput(appId: string, storeCountry = "us"): Record<string, unknown> {
  return {
    mode: "details",
    appIds: [appId],
    country: storeCountry.toLowerCase(),
    includeReviews: true,
    maxItems: 50,
    reviewSort: "mostRecent",
  };
}

/** kind → { actor env resolver, daily input builder } — drives the generic kickoff. */
export const SOURCE_KINDS: Record<
  string,
  { buildInput: (externalRef: string, storeCountry?: string) => Record<string, unknown> }
> = {
  trustpilot: { buildInput: trustpilotDailyInput },
  google_play: { buildInput: googlePlayDailyInput },
  app_store: { buildInput: appStoreDailyInput },
};

/** Start any Apify actor run, registering a completion webhook when reachable. */
export async function startActorRun(
  actorId: string,
  input: Record<string, unknown>,
  webhookQuery: Record<string, string>,
): Promise<{ runId: string; datasetId: string }> {
  const client = apify();

  // Apify only accepts a publicly reachable webhook URL. In production
  // (APP_BASE_URL = https://…) we register it so completion pushes back to us;
  // locally (http://localhost) we skip it and rely on polling instead.
  const isPublic = /^https:\/\//.test(env.APP_BASE_URL) && !/localhost|127\.0\.0\.1/.test(env.APP_BASE_URL);
  const webhooks = isPublic
    ? [
        {
          eventTypes: ["ACTOR.RUN.SUCCEEDED" as const, "ACTOR.RUN.FAILED" as const],
          requestUrl: `${env.APP_BASE_URL}/api/webhooks/apify?${new URLSearchParams({
            token: env.APIFY_WEBHOOK_SECRET,
            ...webhookQuery,
          }).toString()}`,
        },
      ]
    : undefined;

  const run = await client.actor(actorId).start(input, { webhooks });
  return { runId: run.id, datasetId: run.defaultDatasetId };
}

/** @deprecated use {@link startActorRun} with the Trustpilot actor id. */
export async function startTrustpilotRun(
  input: Record<string, unknown>,
  webhookQuery: Record<string, string>,
): Promise<{ runId: string; datasetId: string }> {
  return startActorRun(env.APIFY_TRUSTPILOT_ACTOR, input, webhookQuery);
}

/** Fetch one page of dataset items. */
export async function listDatasetPage(
  datasetId: string,
  offset: number,
  limit: number,
): Promise<Record<string, any>[]> {
  const client = apify();
  const { items } = await client.dataset(datasetId).listItems({ offset, limit, clean: true });
  return items as Record<string, any>[];
}
