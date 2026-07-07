/**
 * Weekly crawl kickoff: enqueue a `crawl_page` job for every active crawl-kind
 * source (homepage / pricing_page / offer_page / blog). Idempotent per day via an
 * `ingest_runs` row keyed by sha256(crawl|sourceId|day) — a second kickoff on the
 * same day enqueues nothing.
 *
 * Unlike the review kickoff, there is no Apify run to start here: fetching happens
 * inside the job (free fetch first, Apify fallback only on a miss).
 */

import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { enqueue } from "@/lib/queue";
import { CRAWL_KINDS } from "./types";

const { sources, ingestRuns } = schema;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function runCrawlKickoff(day = todayUtc()): Promise<{ enqueued: number; skipped: number }> {
  const active = await db
    .select({
      id: sources.id,
      fintechId: sources.fintechId,
      kind: sources.kind,
      externalRef: sources.externalRef,
      country: sources.country,
    })
    .from(sources)
    .where(and(inArray(sources.kind, CRAWL_KINDS as unknown as string[]), eq(sources.active, true)));

  let enqueued = 0;
  let skipped = 0;

  for (const s of active) {
    const runKey = createHash("sha256").update(`crawl|${s.id}|${day}`).digest("hex");

    // Claim this (source, day) exactly once.
    const inserted = await db
      .insert(ingestRuns)
      .values({ runKey, actor: `crawl:${s.kind}`, status: "started" })
      .onConflictDoNothing()
      .returning({ id: ingestRuns.id });

    if (!inserted.length) {
      skipped++;
      continue;
    }

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
    await db
      .update(ingestRuns)
      .set({ status: "succeeded", finishedAt: new Date() })
      .where(eq(ingestRuns.runKey, runKey));
    enqueued++;
  }

  return { enqueued, skipped };
}
