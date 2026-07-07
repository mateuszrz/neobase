/**
 * Crawl-source kickoff primitive: enqueue a `crawl_page` job for ONE crawl source
 * (homepage / pricing_page / offer_page / blog). Idempotent per day via an
 * `ingest_runs` row keyed by sha256(crawl|sourceId|day).
 *
 * Unlike a review source, there is no Apify run to start here — fetching happens
 * inside the job (free fetch first, Apify fallback only on a miss). The cadence/
 * scope-aware orchestration that decides WHICH sources run lives in
 * `lib/ingest/orchestrate.ts`.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue } from "@/lib/queue";

const { ingestRuns } = schema;

/** One active crawl source. */
export interface CrawlSourceRow {
  id: string;
  fintechId: string;
  kind: string;
  externalRef: string;
  country: string;
}

/** Enqueue a crawl for one source on `day`. Idempotent per (source, day). */
export async function enqueueCrawlSource(s: CrawlSourceRow, day: string): Promise<"enqueued" | "skipped"> {
  const runKey = createHash("sha256").update(`crawl|${s.id}|${day}`).digest("hex");

  const inserted = await db
    .insert(ingestRuns)
    .values({ runKey, actor: `crawl:${s.kind}`, status: "started" })
    .onConflictDoNothing()
    .returning({ id: ingestRuns.id });
  if (!inserted.length) return "skipped";

  await enqueue({
    type: "crawl_page",
    payload: {
      sourceId: s.id,
      fintechId: s.fintechId,
      kind: s.kind,
      country: s.country,
      url: s.externalRef,
      snapshotDate: day,
    },
  });
  await db.update(ingestRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(ingestRuns.runKey, runKey));
  return "enqueued";
}
