/**
 * Review-source kickoff primitives: start ONE review source (Trustpilot / Google
 * Play / App Store) for a given day — either enqueue a mock process job (no Apify
 * token) or start a live Apify run whose completion webhook enqueues the process
 * job.
 *
 * Idempotent per day via an `ingest_runs` row keyed by sha256(actor|source|date):
 * a second kickoff on the same day inserts nothing and enqueues nothing.
 *
 * The cadence/scope-aware orchestration that decides WHICH sources run lives in
 * `lib/ingest/orchestrate.ts`; this module only knows how to fire one.
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isApifyLive, apifyActorFor } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import { startActorRun, SOURCE_KINDS } from "@/lib/apify";

const { ingestRuns } = schema;

/** Source kinds with a live review scraper wired up. */
export const SCRAPABLE_KINDS = Object.keys(SOURCE_KINDS);

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function runKeyFor(actor: string, sourceId: string, day: string): string {
  return createHash("sha256").update(`${actor}|${sourceId}|${day}`).digest("hex");
}

/** One active review source, with the fintech's home country as the store market. */
export interface ReviewSourceRow {
  id: string;
  fintechId: string;
  kind: string;
  externalRef: string;
  storeCountry: string | null;
}

/**
 * Kick off one review source for `day`. Returns whether work was enqueued or the
 * (source, day) was already claimed / not runnable.
 */
export async function startReviewSource(s: ReviewSourceRow, day: string): Promise<"enqueued" | "skipped"> {
  const spec = SOURCE_KINDS[s.kind];
  if (!spec) return "skipped";

  const live = isApifyLive();
  const actor = live ? apifyActorFor(s.kind) : `mock:${s.kind}`;
  if (live && !actor) return "skipped"; // no configured actor for this kind

  const runKey = runKeyFor(actor, s.id, day);

  // Claim this (source, day) exactly once.
  const inserted = await db
    .insert(ingestRuns)
    .values({ runKey, actor, status: "started" })
    .onConflictDoNothing()
    .returning({ id: ingestRuns.id });
  if (!inserted.length) return "skipped";

  if (!live) {
    await enqueue({
      type: "process_dataset",
      payload: { sourceId: s.id, fintechId: s.fintechId, kind: s.kind, snapshotDate: day, mock: true, runKey },
    });
    await db.update(ingestRuns).set({ status: "succeeded", finishedAt: new Date() }).where(eq(ingestRuns.runKey, runKey));
    return "enqueued";
  }

  // One run per source keeps dataset→source mapping trivial. The webhook enqueues
  // the process job (carrying `kind`) on completion.
  const { runId, datasetId } = await startActorRun(
    actor,
    spec.buildInput(s.externalRef, s.storeCountry ?? undefined),
    { runKey, sourceId: s.id, fintechId: s.fintechId, snapshotDate: day, kind: s.kind },
  );
  await db.update(ingestRuns).set({ apifyRunId: runId, datasetId }).where(eq(ingestRuns.runKey, runKey));
  return "enqueued";
}
