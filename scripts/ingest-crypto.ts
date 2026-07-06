/**
 * One-off: attach + ingest manually-verified App Store (and where available,
 * Google Play) ids for crypto exchanges whose apps aren't in the US store or
 * whose generic names defeated the search-mode collector. Each app is scraped in
 * a storefront where it's actually listed (global/EU exchanges aren't on US).
 *
 *   npm run apify:crypto
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { isApifyLive, apifyActorFor } from "../lib/env.ts";
import { startActorRun, apify, SOURCE_KINDS } from "../lib/apify/index.ts";
import { processDatasetJob } from "../lib/ingest/process.ts";
import { todayUtc } from "../lib/ingest/kickoff.ts";

const { sources } = schema;

// Verified 2026-07-06 by developer/title match in the app's home storefront.
const CRYPTO: { slug: string; kind: "app_store" | "google_play"; ref: string; country: string }[] = [
  { slug: "gate", kind: "app_store", ref: "1294998195", country: "us" },
  { slug: "bybit", kind: "app_store", ref: "1488296980", country: "us" },
  { slug: "bitvavo", kind: "app_store", ref: "1483903423", country: "nl" },
  { slug: "bitvavo", kind: "google_play", ref: "com.bitvavo.android", country: "nl" },
  { slug: "binance", kind: "app_store", ref: "1436799971", country: "tr" },
  { slug: "swissborg", kind: "app_store", ref: "1442483481", country: "ch" },
  { slug: "bitcoin_suisse", kind: "app_store", ref: "1555493299", country: "ch" },
];

if (!isApifyLive()) {
  console.error("APIFY_TOKEN required.");
  process.exit(1);
}

const day = todayUtc();

for (const c of CRYPTO) {
  try {
    // Upsert + activate the source.
    const upd = await db
      .update(sources)
      .set({ externalRef: c.ref, active: true })
      .where(and(eq(sources.fintechId, c.slug), eq(sources.kind, c.kind), eq(sources.country, "ZZ")))
      .returning({ id: sources.id });
    const sourceId =
      upd[0]?.id ??
      (await db.insert(sources).values({ fintechId: c.slug, kind: c.kind, externalRef: c.ref, country: "ZZ", active: true }).returning({ id: sources.id }))[0].id;

    // Scrape in the app's storefront, then run the standard processor.
    const input = SOURCE_KINDS[c.kind].buildInput(c.ref, c.country);
    const { runId, datasetId } = await startActorRun(apifyActorFor(c.kind), input, {
      runKey: `crypto|${sourceId}|${day}`,
      sourceId,
      fintechId: c.slug,
      snapshotDate: day,
      kind: c.kind,
    });
    const fin = await apify().run(runId).waitForFinish({ waitSecs: 300 });
    if (fin.status !== "SUCCEEDED") throw new Error(`run ${fin.status}`);
    await processDatasetJob({ sourceId, fintechId: c.slug, kind: c.kind, snapshotDate: day, mock: false, datasetId, offset: 0 });

    const [snap] = await db
      .select({ rating: schema.metricSnapshots.rating, count: schema.metricSnapshots.reviewCount })
      .from(schema.metricSnapshots)
      .where(and(eq(schema.metricSnapshots.sourceId, sourceId), eq(schema.metricSnapshots.country, "ZZ"), eq(schema.metricSnapshots.snapshotDate, day)));
    console.log(`  OK   ${c.slug.padEnd(16)} ${c.kind.padEnd(12)} ⭐${snap?.rating ?? "—"} count=${snap?.count ?? "—"}`);
  } catch (e) {
    console.error(`  FAIL ${c.slug} ${c.kind}: ${e instanceof Error ? e.message : e}`);
  }
}

console.log("done");
process.exit(0);
