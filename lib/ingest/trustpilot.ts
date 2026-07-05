/**
 * Trustpilot source logic: a normaliser for real Apify actor items, and a
 * deterministic mock generator used when APIFY_TOKEN is absent.
 *
 * The mock is deterministic (seeded PRNG keyed by source+date) so re-running the
 * pipeline for the same day is fully idempotent — the key property the MVP
 * verification checks (a 3rd run must add nothing new).
 */

// ─── Deterministic PRNG ─────────────────────────────────────────────────────

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rng(seed: string) {
  const r = mulberry32(hashSeed(seed));
  return {
    next: r,
    int: (min: number, max: number) => min + Math.floor(r() * (max - min + 1)),
    pick: <T>(arr: T[]): T => arr[Math.floor(r() * arr.length)],
  };
}

// ─── Shared review shape ────────────────────────────────────────────────────

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

/** Company-level extras stored in metric_snapshots.raw (from the actor's company info). */
export interface CompanyExtras {
  dist: { s1: number; s2: number; s3: number; s4: number; s5: number } | null;
  responseRate: number | null;
  responseTime: string | number | null;
  aiSummary: string | null;
}

export interface SourceAggregate {
  rating: number | null; // overall business rating
  reviewCount: number | null; // total lifetime reviews
}

// ─── Live normaliser (best-effort mapping of the Apify actor's output) ───────

function iso2(v: unknown): string {
  return typeof v === "string" && v.length === 2 ? v.toUpperCase() : "ZZ";
}

/** True for dataset items that are individual reviews (the actor also emits transparency reports). */
export function isReviewItem(item: Record<string, any>): boolean {
  return item.type ? item.type === "review" : Boolean(item.reviewId);
}

/** Map a blackfalcondata/trustpilot-reviews-scraper review item. */
export function normalizeLiveItem(item: Record<string, any>): NormalizedReview {
  const externalId = String(item.reviewId ?? item.reviewUrl ?? item.contentHash);
  const rawDate = item.publishedDate ?? item.experiencedDate ?? item.updatedDate ?? null;
  return {
    externalId,
    rating: typeof item.rating === "number" ? item.rating : null,
    title: item.title ?? null,
    body: item.text ?? null,
    country: iso2(item.reviewerCountry ?? item.countryCode),
    postedAt: rawDate ? new Date(rawDate) : null,
    verified: Boolean(item.isVerified),
    topics: Array.isArray(item.topics) ? item.topics.filter((t: unknown): t is string => typeof t === "string") : [],
  };
}

/** Company-level extras (lifetime rating distribution, responsiveness, AI summary). */
export function extractCompanyExtras(items: Record<string, any>[]): CompanyExtras {
  const c = items.find(
    (i) => i.companyRating5Star != null || i.companyResponseRate != null || i.aiSummary != null,
  );
  const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
  if (!c) return { dist: null, responseRate: null, responseTime: null, aiSummary: null };
  const hasDist = c.companyRating1Star != null || c.companyRating5Star != null;
  return {
    dist: hasDist
      ? {
          s1: num(c.companyRating1Star) ?? 0,
          s2: num(c.companyRating2Star) ?? 0,
          s3: num(c.companyRating3Star) ?? 0,
          s4: num(c.companyRating4Star) ?? 0,
          s5: num(c.companyRating5Star) ?? 0,
        }
      : null,
    responseRate: num(c.companyResponseRate),
    responseTime: typeof c.companyResponseTime === "string" || typeof c.companyResponseTime === "number" ? c.companyResponseTime : null,
    aiSummary: typeof c.aiSummary === "string" && c.aiSummary.trim() ? c.aiSummary : null,
  };
}

/**
 * Overall business rating + total lifetime review count. This actor embeds the
 * company aggregate on every review item (companyTrustScore is the 1–5 TrustScore
 * shown on Trustpilot; companyTotalReviews is the lifetime count).
 */
export function extractLiveAggregate(items: Record<string, any>[]): SourceAggregate {
  const withCompany = items.find(
    (i) => i.companyTrustScore != null || i.trustScore != null || i.companyTotalReviews != null,
  );
  if (withCompany) {
    return {
      rating: withCompany.companyTrustScore ?? withCompany.trustScore ?? withCompany.companyStars ?? null,
      reviewCount: withCompany.companyTotalReviews ?? withCompany.totalReviews ?? null,
    };
  }
  const ratings = items.map((i) => i.rating).filter((r) => typeof r === "number");
  if (!ratings.length) return { rating: null, reviewCount: null };
  const avg = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
  return { rating: avg, reviewCount: null };
}

// ─── Mock generator ─────────────────────────────────────────────────────────

const SNIPPETS_POS = [
  "Instant transfers and a clean app, exactly what I needed.",
  "Card arrived quickly and fees are transparent. Happy customer.",
  "Support resolved my issue within the hour. Impressed.",
  "Great exchange rates when travelling abroad.",
];
const SNIPPETS_NEG = [
  "Account got frozen with no explanation for days.",
  "Customer support is chat-bots only, never reached a human.",
  "Hidden weekend surcharge on currency exchange.",
  "App crashed during a payment and money was stuck.",
];

export interface MockDay {
  reviews: NormalizedReview[];
  aggregate: SourceAggregate;
}

/**
 * Produce a deterministic day of Trustpilot activity continuing from a baseline.
 * @param homeCountry ISO2 of the fintech, weighted heavily in reviewer origin.
 * @param baseline last known aggregate (from the seeded/previous snapshot).
 */
export function mockTrustpilotDay(
  sourceId: string,
  snapshotDate: string,
  homeCountry: string | null,
  baseline: SourceAggregate,
): MockDay {
  const r = rng(`${sourceId}:${snapshotDate}`);
  const baseRating = baseline.rating ?? 4.0;
  const baseCount = baseline.reviewCount ?? 1000;

  const newReviews = r.int(4, 28);
  const totalCount = baseCount + newReviews;
  const drift = (r.next() - 0.5) * 0.06;
  const rating = Math.min(5, Math.max(1, Math.round((baseRating + drift) * 100) / 100));

  const home = homeCountry && homeCountry.length === 2 ? homeCountry : "GB";
  const countryPool = [home, home, home, "US", "DE", "FR", "PL", "ES", "NL"];

  const reviews: NormalizedReview[] = [];
  for (let i = 0; i < newReviews; i++) {
    const positive = r.next() > (baseRating >= 4 ? 0.35 : 0.55);
    const stars = positive ? r.int(4, 5) : r.int(1, 3);
    reviews.push({
      externalId: `mock-${sourceId}-${snapshotDate}-${i}`,
      rating: stars,
      title: positive ? "Solid experience" : "Needs improvement",
      body: positive ? r.pick(SNIPPETS_POS) : r.pick(SNIPPETS_NEG),
      country: r.pick(countryPool),
      postedAt: new Date(`${snapshotDate}T12:00:00Z`),
      verified: r.next() > 0.4,
      topics: [],
    });
  }

  return { reviews, aggregate: { rating, reviewCount: totalCount } };
}
