/**
 * Processes one `process_dataset` job: pull a page of Trustpilot data (live from
 * an Apify dataset, or the deterministic mock), then idempotently upsert
 * individual reviews and roll them up into daily metric_snapshots — a global
 * ("ZZ") series plus per-country series (segmentation by reviewer origin).
 */

import { and, desc, eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isApifyLive } from "@/lib/env";
import { listDatasetPage } from "@/lib/apify";
import { mockTrustpilotDay } from "./trustpilot";
import { HANDLERS } from "./handlers";
import { sentimentShare, type DaySummary, type NormalizedReview, type SourceAggregate } from "./types";

const { fintechs, reviews, metricSnapshots } = schema;
const PAGE_SIZE = 1000;

export interface ProcessPayload {
  sourceId: string;
  fintechId: string;
  kind: string;
  snapshotDate: string; // YYYY-MM-DD
  mock?: boolean;
  datasetId?: string | null;
  offset?: number;
}

export interface ProcessResult {
  done: boolean;
  nextOffset?: number;
  reviewsUpserted: number;
  snapshotsWritten: number;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function baselineAggregate(sourceId: string, before: string): Promise<SourceAggregate> {
  const [row] = await db
    .select({ rating: metricSnapshots.rating, reviewCount: metricSnapshots.reviewCount })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.sourceId, sourceId),
        eq(metricSnapshots.country, "ZZ"),
        lt(metricSnapshots.snapshotDate, before),
      ),
    )
    .orderBy(desc(metricSnapshots.snapshotDate))
    .limit(1);
  return { rating: num(row?.rating), reviewCount: num(row?.reviewCount) };
}

async function upsertReviews(
  p: ProcessPayload,
  items: NormalizedReview[],
): Promise<number> {
  if (!items.length) return 0;
  const rows = items.map((r) => ({
    sourceId: p.sourceId,
    fintechId: p.fintechId,
    country: r.country,
    externalId: r.externalId,
    rating: r.rating ?? null,
    title: r.title,
    body: r.body,
    postedAt: r.postedAt,
  }));
  await db.insert(reviews).values(rows).onConflictDoNothing();
  return rows.length;
}

async function writeSnapshot(row: typeof metricSnapshots.$inferInsert): Promise<void> {
  await db
    .insert(metricSnapshots)
    .values(row)
    .onConflictDoUpdate({
      target: [metricSnapshots.sourceId, metricSnapshots.country, metricSnapshots.snapshotDate],
      set: {
        rating: row.rating ?? null,
        reviewCount: row.reviewCount ?? null,
        reviewCountDelta: row.reviewCountDelta ?? null,
        sentimentPos: row.sentimentPos ?? null,
        sentimentNeg: row.sentimentNeg ?? null,
        raw: row.raw ?? null,
      },
    });
}

export async function processDatasetJob(p: ProcessPayload): Promise<ProcessResult> {
  const offset = p.offset ?? 0;
  const useMock = p.mock ?? !isApifyLive();

  // Resolve fintech home country for mock reviewer-origin weighting.
  const [ft] = await db
    .select({ country: fintechs.country })
    .from(fintechs)
    .where(eq(fintechs.id, p.fintechId))
    .limit(1);

  // Handler encapsulates per-source parsing (Trustpilot / Google Play / App Store).
  const handler = HANDLERS[p.kind];
  if (!handler) throw new Error(`no ingest handler for kind "${p.kind}"`);

  let dayReviews: NormalizedReview[] = [];
  let summary: DaySummary = { rating: null, reviewCount: null, pos: null, neg: null, raw: null };
  let done = true;
  let nextOffset: number | undefined;

  if (useMock) {
    const baseline = await baselineAggregate(p.sourceId, p.snapshotDate);
    const day = mockTrustpilotDay(p.sourceId, p.snapshotDate, ft?.country ?? null, baseline);
    dayReviews = day.reviews;
    const s = sentimentShare(dayReviews);
    summary = { rating: day.aggregate.rating, reviewCount: day.aggregate.reviewCount, pos: s.pos, neg: s.neg, raw: null };
  } else {
    if (!p.datasetId) throw new Error("live mode requires datasetId");
    const items = await listDatasetPage(p.datasetId, offset, PAGE_SIZE);
    dayReviews = items.filter((i) => handler.isReviewItem(i)).map((i) => handler.normalizeReview(i));
    if (offset === 0) summary = handler.summarize(items, dayReviews);
    if (items.length === PAGE_SIZE) {
      done = false;
      nextOffset = offset + PAGE_SIZE;
    }
  }

  const reviewsUpserted = await upsertReviews(p, dayReviews);
  let snapshotsWritten = 0;

  // Global (ZZ) rollup — only on the first page so re-paginating won't double-count.
  if (offset === 0) {
    const baseline = await baselineAggregate(p.sourceId, p.snapshotDate);

    await writeSnapshot({
      sourceId: p.sourceId,
      fintechId: p.fintechId,
      kind: p.kind,
      country: "ZZ",
      snapshotDate: p.snapshotDate,
      rating: summary.rating != null ? String(summary.rating) : null,
      reviewCount: summary.reviewCount,
      reviewCountDelta:
        summary.reviewCount != null && baseline.reviewCount != null
          ? summary.reviewCount - baseline.reviewCount
          : null,
      sentimentPos: summary.pos != null ? String(summary.pos) : null,
      sentimentNeg: summary.neg != null ? String(summary.neg) : null,
      raw: summary.raw,
    });
    snapshotsWritten++;

    // Per-country rollup from this day's reviews (segmentation by origin).
    const byCountry = new Map<string, NormalizedReview[]>();
    for (const r of dayReviews) {
      if (r.country === "ZZ") continue;
      (byCountry.get(r.country) ?? byCountry.set(r.country, []).get(r.country)!).push(r);
    }
    for (const [country, list] of byCountry) {
      const rated = list.filter((r) => typeof r.rating === "number");
      const avg = rated.length
        ? Math.round((rated.reduce((a, r) => a + (r.rating as number), 0) / rated.length) * 100) / 100
        : null;
      const cs = sentimentShare(list);
      await writeSnapshot({
        sourceId: p.sourceId,
        fintechId: p.fintechId,
        kind: p.kind,
        country,
        snapshotDate: p.snapshotDate,
        rating: avg != null ? String(avg) : null,
        reviewCount: list.length,
        reviewCountDelta: null,
        sentimentPos: cs.pos != null ? String(cs.pos) : null,
        sentimentNeg: cs.neg != null ? String(cs.neg) : null,
      });
      snapshotsWritten++;
    }
  }

  return { done, nextOffset, reviewsUpserted, snapshotsWritten };
}
