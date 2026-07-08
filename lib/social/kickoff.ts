/**
 * Social-source kickoff: start ONE LinkedIn/Facebook Apify run for a fintech and
 * let its completion webhook enqueue the collect_social job. Mirrors the review
 * kickoff (lib/ingest/kickoff) — same ingest_runs idempotency, same webhook
 * plumbing (startActorRun) — but for social posts instead of review aggregates.
 *
 * Dormant until the network's actor env is set: with no actor it returns
 * "skipped" without starting a run (profiles keep rendering sample posts).
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { startActorRun } from "@/lib/apify";
import { actorFor, handleFrom, networkOf, socialInput } from "./apify";

const { ingestRuns, fintechs } = schema;

export interface SocialSourceRow {
  id: string; // sources.id
  fintechId: string;
  kind: string; // social_linkedin | social_facebook
  externalRef: string; // handle URL (may be a fallback; we re-resolve from socials)
}

export async function startSocialSource(s: SocialSourceRow, day: string): Promise<"enqueued" | "skipped"> {
  const network = networkOf(s.kind);
  if (!network) return "skipped";

  const actor = actorFor(network);
  if (!actor) return "skipped"; // dormant — no actor configured for this network

  // Prefer the live handle from fintechs.socials; fall back to the seeded ref.
  const [ft] = await db.select({ socials: fintechs.socials }).from(fintechs).where(eq(fintechs.id, s.fintechId)).limit(1);
  const handle = handleFrom(ft?.socials, network) ?? s.externalRef;
  if (!handle) return "skipped";

  const runKey = createHash("sha256").update(`${actor}|social:${s.id}|${day}`).digest("hex");

  // Claim this (source, day) exactly once.
  const inserted = await db
    .insert(ingestRuns)
    .values({ runKey, actor, status: "started" })
    .onConflictDoNothing()
    .returning({ id: ingestRuns.id });
  if (!inserted.length) return "skipped";

  const { runId, datasetId } = await startActorRun(actor, socialInput(handle), {
    runKey,
    sourceId: s.id,
    fintechId: s.fintechId,
    network,
    kind: s.kind,
    snapshotDate: day,
  });
  await db.update(ingestRuns).set({ apifyRunId: runId, datasetId }).where(eq(ingestRuns.runKey, runKey));
  return "enqueued";
}
