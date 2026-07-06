/**
 * Trustpilot source logic: a normaliser for real Apify actor items, and a
 * deterministic mock generator used when APIFY_TOKEN is absent.
 *
 * The mock is deterministic (seeded PRNG keyed by source+date) so re-running the
 * pipeline for the same day is fully idempotent — the key property the MVP
 * verification checks (a 3rd run must add nothing new).
 */

import type { KindHandler, NormalizedReview, SourceAggregate, DaySummary, Dist } from "./types";
import { distSentiment } from "./types";

export type { NormalizedReview, SourceAggregate } from "./types";

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

// ─── Company aggregate handler (companyInfo mode — no reviews, no PII) ───────

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 1–5★ distribution from a companyInfo item (rating1Star … rating5Star). */
function companyDist(c: Record<string, any>): Dist | null {
  const s1 = num(c.rating1Star);
  const s5 = num(c.rating5Star);
  if (s1 == null && s5 == null) return null;
  return {
    s1: s1 ?? 0,
    s2: num(c.rating2Star) ?? 0,
    s3: num(c.rating3Star) ?? 0,
    s4: num(c.rating4Star) ?? 0,
    s5: s5 ?? 0,
  };
}

/**
 * Trustpilot handler. `companyInfo` mode yields the company aggregate only —
 * TrustScore, lifetime review count, star distribution, response rate/time —
 * with no individual reviews. Sentiment is derived from the distribution.
 */
export const trustpilotHandler: KindHandler = {
  isReviewItem: () => false, // companyInfo mode returns no review items
  normalizeReview: () => {
    throw new Error("trustpilot companyInfo mode returns no reviews");
  },
  summarize(items): DaySummary {
    const c = items.find((i) => i.type === "companyInfo" || i.trustScore != null) ?? {};
    const dist = companyDist(c);
    const s = dist ? distSentiment(dist) : { pos: null, neg: null };
    return {
      rating: num(c.trustScore) ?? num(c.stars),
      reviewCount: num(c.totalReviews),
      pos: s.pos,
      neg: s.neg,
      raw: {
        dist,
        responseRate: num(c.responseRate),
        responseTime:
          typeof c.responseTime === "string" || typeof c.responseTime === "number" ? c.responseTime : null,
        aiSummary: typeof c.aiSummary === "string" && c.aiSummary.trim() ? c.aiSummary : null,
      },
    };
  },
};

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
