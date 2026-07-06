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

/** Positive/negative share from a set of ratings (>=4 stars counts positive). */
export function sentimentShare(reviews: { rating: number | null }[]): { pos: number | null; neg: number | null } {
  const rated = reviews.filter((r) => typeof r.rating === "number");
  if (!rated.length) return { pos: null, neg: null };
  const pos = rated.filter((r) => (r.rating as number) >= 4).length;
  const posPct = Math.round((pos / rated.length) * 1000) / 10;
  return { pos: posPct, neg: Math.round((100 - posPct) * 10) / 10 };
}
