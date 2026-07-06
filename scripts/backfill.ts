/**
 * Bulk-backfill one source kind across every active source, in parallel batches.
 * Reuses the exact production pipeline (startActorRun → waitForFinish →
 * processDatasetJob). Idempotent: re-running overwrites today's snapshot.
 *
 *   npm run apify:backfill -- trustpilot 10      # kind, batch size
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { isApifyLive, apifyActorFor } from "../lib/env.ts";
import { startActorRun, apify, SOURCE_KINDS } from "../lib/apify/index.ts";
import { processDatasetJob } from "../lib/ingest/process.ts";
import { todayUtc } from "../lib/ingest/kickoff.ts";

const { sources, fintechs } = schema;
const kind = process.argv[2] ?? "trustpilot";
const BATCH = Number(process.argv[3] ?? 10);

const actor = apifyActorFor(kind);
const spec = SOURCE_KINDS[kind];
if (!isApifyLive() || !actor || !spec) {
  console.error(`APIFY_TOKEN and the actor for kind "${kind}" must be set in .env.`);
  process.exit(1);
}

const rows = await db
  .select({
    id: sources.id,
    fintechId: sources.fintechId,
    externalRef: sources.externalRef,
    storeCountry: fintechs.country,
  })
  .from(sources)
  .innerJoin(fintechs, eq(fintechs.id, sources.fintechId))
  .where(and(eq(sources.kind, kind), eq(sources.active, true)));

const day = todayUtc();
console.log(`Backfilling ${kind} for ${rows.length} sources (batch ${BATCH}, day ${day})…`);

let ok = 0;
let fail = 0;

function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

const batches = chunk(rows, BATCH);
for (const [bi, batch] of batches.entries()) {
  await Promise.all(
    batch.map(async (s) => {
      try {
        const { runId, datasetId } = await startActorRun(
          actor,
          spec.buildInput(s.externalRef, s.storeCountry ?? undefined),
          { runKey: `backfill|${s.id}|${day}`, sourceId: s.id, fintechId: s.fintechId, snapshotDate: day, kind },
        );
        const fin = await apify().run(runId).waitForFinish({ waitSecs: 300 });
        if (fin.status !== "SUCCEEDED") throw new Error(`run ${fin.status}`);
        await processDatasetJob({ sourceId: s.id, fintechId: s.fintechId, kind, snapshotDate: day, mock: false, datasetId, offset: 0 });
        ok++;
      } catch (e) {
        fail++;
        console.error(`  FAIL ${s.fintechId}: ${e instanceof Error ? e.message : e}`);
      }
    }),
  );
  console.log(`batch ${bi + 1}/${batches.length}: ok=${ok} fail=${fail}`);
}

console.log(`\nDone ${kind}. ok=${ok} fail=${fail}`);
process.exit(0);
