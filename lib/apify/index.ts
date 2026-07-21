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
// Every source fetches ONLY the anonymised aggregate (rating + total count +
// 1–5★ histogram) — never individual reviews. Sentiment is derived from the
// histogram, so a run carries no personal data and costs a fraction of a
// review scrape.

/**
 * Trustpilot: `companyInfo` mode returns the company aggregate — TrustScore,
 * lifetime review count, 1–5★ distribution, response rate/time — with no
 * reviews. Sentiment comes from the distribution.
 */
export function trustpilotDailyInput(domain: string, _storeCountry?: string): Record<string, unknown> {
  return { mode: "companyInfo", companyDomain: domain };
}

/**
 * Google Play: `details` mode returns the app aggregate (score, total ratings,
 * 1–5★ histogram) in a single item — rating, volume AND sentiment all from the
 * store listing, no reviews.
 */
export function googlePlayDailyInput(appId: string, storeCountry = "us"): Record<string, unknown> {
  return { mode: "details", appIds: [appId], country: storeCountry.toLowerCase(), language: "en" };
}

/**
 * Storefronts the App Store actor accepts. Anything else is rejected outright
 * ("Field input.country must be equal to one of the allowed values"), which
 * fails the whole run rather than degrading.
 *
 * We pass the fintech's home country as the storefront, and a company can
 * legitimately be domiciled somewhere Apple's actor does not list — five
 * exchanges failed every single run this way: AstroPay (UY), Bitfinex (VG),
 * Bitget and OKX (SC), Bitstamp (LU). Those are global apps whose registered
 * office happens to sit in a small jurisdiction.
 */
const APP_STORE_STOREFRONTS = new Set([
  "us", "gb", "ca", "au", "in", "ie", "nz", "za", "sg", "ph", "fr", "de", "es", "it", "nl", "be",
  "pt", "pl", "se", "dk", "fi", "no", "at", "ch", "cz", "sk", "hu", "ro", "gr", "ua", "ru", "tr",
  "br", "mx", "ar", "cl", "co", "pe", "jp", "kr", "cn", "tw", "hk", "id", "my", "th", "vn", "sa",
  "ae", "eg", "il", "ng",
]);

/**
 * App Store: `ratings` mode returns the all-time rating count + 1–5★ histogram
 * (Apple exposes no average, so we compute it from the histogram). No reviews.
 * `externalRef` is the numeric App Store id.
 *
 * An unsupported storefront falls back to `us` — the largest one, where a
 * global app is always listed. The alternative is no App Store data at all for
 * that brand. The snapshot is stored against country `ZZ` (global) either way,
 * so the fallback does not misattribute the numbers to a market.
 */
export function appStoreDailyInput(appId: string, storeCountry = "us"): Record<string, unknown> {
  const cc = storeCountry.toLowerCase();
  return { mode: "ratings", id: Number(appId), country: APP_STORE_STOREFRONTS.has(cc) ? cc : "us" };
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
