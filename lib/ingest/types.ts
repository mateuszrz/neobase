/**
 * Shared ingest contracts. Each review source (Trustpilot, Google Play, App
 * Store) implements a {@link KindHandler}; `processDatasetJob` stays source-
 * agnostic and just dispatches by `kind`.
 */

/** Normalised individual review, uniform across sources. */
export interface NormalizedReview {
  externalId: string;
  rating: number | null;
  title: string | null;
  body: string | null;
  country: string; // ISO2 reviewer origin, "ZZ" if unknown
  postedAt: Date | null;
  verified: boolean;
  topics: string[];
}

/** Source-level headline aggregate (the store/company rating + lifetime count). */
export interface SourceAggregate {
  rating: number | null;
  reviewCount: number | null;
}

/** Everything needed to write one global ("ZZ") daily metric_snapshots row. */
export interface DaySummary {
  rating: number | null;
  reviewCount: number | null;
  pos: number | null; // positive sentiment share (%)
  neg: number | null;
  raw: Record<string, unknown> | null; // source-specific extras (dist, responsiveness, version…)
}

/** Per-kind logic for turning a raw Apify dataset into reviews + a daily summary. */
export interface KindHandler {
  /** True for dataset items that are individual reviews (vs the app/company aggregate item). */
  isReviewItem(item: Record<string, any>): boolean;
  /** Map one raw review item to the uniform shape. */
  normalizeReview(item: Record<string, any>): NormalizedReview;
  /** Build the global daily summary from the full dataset + this day's normalized reviews. */
  summarize(items: Record<string, any>[], dayReviews: NormalizedReview[]): DaySummary;
}

export function iso2(v: unknown): string {
  return typeof v === "string" && v.length === 2 ? v.toUpperCase() : "ZZ";
}

/** 1–5★ rating distribution (counts). Stored in metric_snapshots.raw and drives sentiment. */
export interface Dist {
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
}

const distTotal = (d: Dist) => d.s1 + d.s2 + d.s3 + d.s4 + d.s5;

/** Positive/negative share from a star histogram (4–5★ positive). */
export function distSentiment(d: Dist): { pos: number | null; neg: number | null } {
  const total = distTotal(d);
  if (total <= 0) return { pos: null, neg: null };
  const pos = Math.round(((d.s4 + d.s5) / total) * 1000) / 10;
  return { pos, neg: Math.round((100 - pos) * 10) / 10 };
}

/** Weighted average rating from a star histogram. */
export function distAverage(d: Dist): number | null {
  const total = distTotal(d);
  if (total <= 0) return null;
  return Math.round(((d.s1 + 2 * d.s2 + 3 * d.s3 + 4 * d.s4 + 5 * d.s5) / total) * 100) / 100;
}

/** Positive/negative share from a set of ratings (>=4 stars counts positive). */
export function sentimentShare(reviews: { rating: number | null }[]): { pos: number | null; neg: number | null } {
  const rated = reviews.filter((r) => typeof r.rating === "number");
  if (!rated.length) return { pos: null, neg: null };
  const pos = rated.filter((r) => (r.rating as number) >= 4).length;
  const posPct = Math.round((pos / rated.length) * 1000) / 10;
  return { pos: posPct, neg: Math.round((100 - posPct) * 10) / 10 };
}
