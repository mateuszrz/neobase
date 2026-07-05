/**
 * Daily kickoff: for every active Trustpilot source, either enqueue a mock
 * process job (no Apify token) or start a live Apify run whose completion webhook
 * enqueues the process job.
 *
 * Idempotent per day via an `ingest_runs` row keyed by sha256(actor|source|date):
 * a second kickoff on the same day inserts nothing and enqueues nothing.
 */

import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isApifyLive, env } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import { startTrustpilotRun } from "@/lib/apify";

const { sources, ingestRuns } = schema;

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function runKeyFor(actor: string, sourceId: string, day: string): string {
  return createHash("sha256").update(`${actor}|${sourceId}|${day}`).digest("hex");
}

export async function runDailyKickoff(day = todayUtc()): Promise<{ enqueued: number; skipped: number }> {
  const active = await db
    .select()
    .from(sources)
    .where(and(eq(sources.kind, "trustpilot"), eq(sources.active, true)));

  const live = isApifyLive();
  const actor = live ? env.APIFY_TRUSTPILOT_ACTOR : "mock:trustpilot";
  let enqueued = 0;
  let skipped = 0;

  for (const s of active) {
    const runKey = runKeyFor(actor, s.id, day);

    // Guard: claim this (source, day) exactly once.
    const inserted = await db
      .insert(ingestRuns)
      .values({ runKey, actor, status: "started" })
      .onConflictDoNothing()
      .returning({ id: ingestRuns.id });

    if (!inserted.length) {
      skipped++;
      continue;
    }

    if (!live) {
      await enqueue({
        type: "process_dataset",
        payload: {
          sourceId: s.id,
          fintechId: s.fintechId,
          kind: s.kind,
          snapshotDate: day,
          mock: true,
          runKey,
        },
      });
      await db
        .update(ingestRuns)
        .set({ status: "succeeded", finishedAt: new Date() })
        .where(eq(ingestRuns.runKey, runKey));
      enqueued++;
    } else {
      // One run per source keeps dataset→source mapping trivial (batching is a
      // later optimisation). The webhook enqueues the process job on completion.
      const { runId, datasetId } = await startTrustpilotRun(
        { companyDomain: s.externalRef, maxResults: 200, includeCompanyInfo: true },
        { runKey, sourceId: s.id, fintechId: s.fintechId, snapshotDate: day },
      );
      await db
        .update(ingestRuns)
        .set({ apifyRunId: runId, datasetId })
        .where(eq(ingestRuns.runKey, runKey));
      enqueued++;
    }
  }

  return { enqueued, skipped };
}
