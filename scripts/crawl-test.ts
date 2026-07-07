/**
 * End-to-end crawl test for one fintech, run over TWO snapshot dates a week apart
 * so week-over-week change detection is exercised.
 *
 *   npm run crawl:test -- revolut                 # homepage
 *   npm run crawl:test -- revolut pricing_page    # a specific crawl kind
 *
 * In mock mode (no ANTHROPIC_API_KEY) extraction is deterministic and the two
 * dates differ just enough to produce a detectable change — validating the whole
 * fetch→extract→snapshot→diff path offline. In live mode it fetches the real page
 * (free fetch, Apify fallback) and runs Claude extraction/diff.
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { isClaudeLive } from "../lib/anthropic/index.ts";
import { processCrawlJob } from "../lib/crawl/process.ts";
import { isCrawlKind } from "../lib/crawl/types.ts";

const { sources, fintechs, contentSnapshots, contentChanges } = schema;

const fintechId = process.argv[2] ?? "revolut";
const kind = process.argv[3] ?? "homepage";

if (!isCrawlKind(kind)) {
  console.error(`"${kind}" is not a crawl kind (homepage | pricing_page | offer_page | blog)`);
  process.exit(1);
}

// Resolve the source; for homepage, fall back to the fintech's website and
// upsert an ephemeral source so the FK is satisfied.
let [src] = await db
  .select({ id: sources.id, externalRef: sources.externalRef, country: sources.country })
  .from(sources)
  .where(and(eq(sources.fintechId, fintechId), eq(sources.kind, kind)))
  .limit(1);

if (!src && kind === "homepage") {
  const [f] = await db.select({ website: fintechs.website }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!f?.website) {
    console.error(`No ${kind} source and no website for "${fintechId}". Run crawl:seed or add a source.`);
    process.exit(1);
  }
  const url = /^https?:\/\//i.test(f.website) ? f.website : `https://${f.website}`;
  const [ins] = await db
    .insert(sources)
    .values({ fintechId, kind: "homepage", externalRef: url, country: "ZZ", active: true })
    .onConflictDoNothing({ target: [sources.fintechId, sources.kind, sources.externalRef, sources.country] })
    .returning({ id: sources.id, externalRef: sources.externalRef, country: sources.country });
  src = ins ?? (await db
    .select({ id: sources.id, externalRef: sources.externalRef, country: sources.country })
    .from(sources)
    .where(and(eq(sources.fintechId, fintechId), eq(sources.kind, kind)))
    .limit(1))[0];
}

if (!src) {
  console.error(`No ${kind} source for "${fintechId}". Run crawl:seed or add one.`);
  process.exit(1);
}

const mode = isClaudeLive() ? "LIVE (Claude)" : "MOCK (deterministic)";
console.log(`Crawl test — ${fintechId} / ${kind} · ${mode} · ${src.externalRef}\n`);

// Two dates a week apart to surface a week-over-week change.
const dates = ["2026-07-01", "2026-07-08"];
for (const day of dates) {
  const res = await processCrawlJob({
    sourceId: src.id,
    fintechId,
    kind,
    country: src.country,
    url: src.externalRef,
    snapshotDate: day,
  });
  console.log(`  ${day}: snapshot via=${res.via} · changed=${res.changed} · changeRows=${res.changesWritten}`);
}

// Report the stored snapshots + any detected change.
const snaps = await db
  .select({ date: contentSnapshots.snapshotDate, hash: contentSnapshots.contentHash, extracted: contentSnapshots.extracted })
  .from(contentSnapshots)
  .where(and(eq(contentSnapshots.sourceId, src.id), eq(contentSnapshots.country, src.country)))
  .orderBy(contentSnapshots.snapshotDate);

console.log(`\nSnapshots (${snaps.length}):`);
for (const s of snaps) console.log(`  ${s.date}  ${s.hash.slice(0, 12)}…  plans=${(s.extracted as any)?.plans?.length ?? 0}`);

const changes = await db
  .select({ from: contentChanges.fromDate, to: contentChanges.toDate, kinds: contentChanges.changeKinds, summary: contentChanges.summary })
  .from(contentChanges)
  .where(eq(contentChanges.sourceId, src.id))
  .orderBy(contentChanges.toDate);

console.log(`\nDetected changes (${changes.length}):`);
for (const c of changes) console.log(`  ${c.from} → ${c.to}  [${(c.kinds ?? []).join(", ")}]\n    ${c.summary}`);

process.exit(0);
