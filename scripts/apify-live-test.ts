/**
 * Full LIVE ingest for a single fintech, bypassing the webhook (which needs a
 * public URL). Starts the actor, waits for completion via polling, then runs the
 * exact production processor (processDatasetJob) against the real dataset and
 * writes a daily snapshot.
 *
 *   npm run apify:test -- revolut
 *
 * Locally we poll; on Vercel the same processing is triggered by the Apify
 * completion webhook → drain-queue. This script validates the normaliser + DB
 * writes end-to-end without a public endpoint.
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { isApifyLive } from "../lib/env.ts";
import { startTrustpilotRun, apify, trustpilotDailyInput } from "../lib/apify/index.ts";
import { processDatasetJob } from "../lib/ingest/process.ts";
import { todayUtc } from "../lib/ingest/kickoff.ts";

const { sources } = schema;
const fintechId = process.argv[2] ?? "revolut";

if (!isApifyLive()) {
  console.error("APIFY_TOKEN and APIFY_TRUSTPILOT_ACTOR must be set in .env for the live test.");
  process.exit(1);
}

const [src] = await db
  .select()
  .from(sources)
  .where(and(eq(sources.fintechId, fintechId), eq(sources.kind, "trustpilot")))
  .limit(1);

if (!src) {
  console.error(`No trustpilot source for fintech "${fintechId}". Seed first.`);
  process.exit(1);
}

const day = todayUtc();
console.log(`Starting live Trustpilot run for ${fintechId} (domain=${src.externalRef})…`);

// startTrustpilotRun registers a webhook we won't receive locally — we poll instead.
const { runId, datasetId } = await startTrustpilotRun(
  trustpilotDailyInput(src.externalRef),
  { runKey: `livetest|${src.id}|${day}`, sourceId: src.id, fintechId, snapshotDate: day },
);
console.log(`Run ${runId} started; waiting for completion…`);

const finished = await apify().run(runId).waitForFinish({ waitSecs: 600 });
console.log(`Run finished with status: ${finished.status}`);

const result = await processDatasetJob({
  sourceId: src.id,
  fintechId,
  kind: "trustpilot",
  snapshotDate: day,
  mock: false,
  datasetId,
  offset: 0,
});
console.log("Processed:", result);

const rows = await db
  .select()
  .from(schema.metricSnapshots)
  .where(and(eq(schema.metricSnapshots.sourceId, src.id), eq(schema.metricSnapshots.snapshotDate, day)));
console.log(`\nSnapshots written for ${day}:`);
for (const r of rows) console.log(`  ${r.country}  ⭐${r.rating ?? "—"}  count=${r.reviewCount ?? "—"}  pos%=${r.sentimentPos ?? "—"}`);
process.exit(0);
