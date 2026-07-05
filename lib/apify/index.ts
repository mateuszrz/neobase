/**
 * Thin Apify wrapper. Only used when APIFY_TOKEN + actor are configured;
 * otherwise the pipeline runs against the deterministic mock and never calls out.
 */

import { ApifyClient } from "apify-client";
import { env } from "@/lib/env";

export function apify(): ApifyClient {
  return new ApifyClient({ token: env.APIFY_TOKEN });
}

/** Start a Trustpilot actor run, registering a completion webhook. */
export async function startTrustpilotRun(
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

  const run = await client.actor(env.APIFY_TRUSTPILOT_ACTOR).start(input, { webhooks });
  return { runId: run.id, datasetId: run.defaultDatasetId };
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
