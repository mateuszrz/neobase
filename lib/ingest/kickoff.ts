/**
 * Daily kickoff: for every active Trustpilot source, either enqueue a mock
 * process job (no Apify token) or start a live Apify run whose completion webhook
 * enqueues the process job.
 *
 * Idempotent per day via an `ingest_runs` row keyed by sha256(actor|source|date):
 * a second kickoff on the same day inserts nothing and enqueues nothing.
 */

import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isApifyLive, apifyActorFor } from "@/lib/env";
import { enqueue } from "@/lib/queue";
import { startActorRun, SOURCE_KINDS } from "@/lib/apify";

const { sources, fintechs, ingestRuns } = schema;

/** Source kinds with a live scraper wired up (order irrelevant). */
const SCRAPABLE_KINDS = Object.keys(SOURCE_KINDS);

export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function runKeyFor(actor: string, sourceId: string, day: string): string {
  return createHash("sha256").update(`${actor}|${sourceId}|${day}`).digest("hex");
}

export async function runDailyKickoff(day = todayUtc()): Promise<{ enqueued: number; skipped: number }> {
  // Active sources across every wired-up kind, with the fintech's home country
  // (used as the store market for Google Play / App Store scrapes).
  const active = await db
    .select({
      id: sources.id,
      fintechId: sources.fintechId,
      kind: sources.kind,
      externalRef: sources.externalRef,
      storeCountry: fintechs.country,
    })
    .from(sources)
    .innerJoin(fintechs, eq(fintechs.id, sources.fintechId))
    .where(and(inArray(sources.kind, SCRAPABLE_KINDS), eq(sources.active, true)));

  const live = isApifyLive();
  let enqueued = 0;
  let skipped = 0;

  for (const s of active) {
    const spec = SOURCE_KINDS[s.kind];
    if (!spec) {
      skipped++;
      continue;
    }
    const actor = live ? apifyActorFor(s.kind) : `mock:${s.kind}`;
    // In live mode a kind with no configured actor can't run — skip it.
    if (live && !actor) {
      skipped++;
      continue;
    }

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
        payload: { sourceId: s.id, fintechId: s.fintechId, kind: s.kind, snapshotDate: day, mock: true, runKey },
      });
      await db
        .update(ingestRuns)
        .set({ status: "succeeded", finishedAt: new Date() })
        .where(eq(ingestRuns.runKey, runKey));
      enqueued++;
    } else {
      // One run per source keeps dataset→source mapping trivial. The webhook
      // enqueues the process job (carrying `kind`) on completion.
      const { runId, datasetId } = await startActorRun(
        actor,
        spec.buildInput(s.externalRef, s.storeCountry ?? undefined),
        { runKey, sourceId: s.id, fintechId: s.fintechId, snapshotDate: day, kind: s.kind },
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
