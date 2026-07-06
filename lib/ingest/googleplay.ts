/**
 * Google Play source handler. We scrape the actor's `details` mode, which returns
 * a single app-info item carrying the store aggregate: `score` (rating),
 * `ratings` (lifetime rating count) and the 1–5★ `histogramNstar` breakdown — so
 * rating, volume AND sentiment all come from the store listing, no individual
 * reviews needed. If a `reviews`-mode dataset is ever passed in, the review
 * mapping below still applies.
 */

import type { KindHandler, NormalizedReview, DaySummary } from "./types";
import { iso2, sentimentShare } from "./types";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** App-info items carry a total ratings count; review items carry per-user text. */
export function isReviewItem(item: Record<string, any>): boolean {
  return item.ratings == null && (item.reviewId != null || item.userName != null || item.text != null);
}

export function normalizeReview(item: Record<string, any>): NormalizedReview {
  const raw = item.date ?? item.at ?? null;
  return {
    externalId: String(item.reviewId ?? item.id ?? item.url),
    rating: num(item.score),
    title: item.title ?? null,
    body: item.text ?? null,
    country: iso2(item.country),
    postedAt: raw ? new Date(raw) : null,
    verified: false,
    topics: [],
  };
}

/** Star histogram → {s1..s5} distribution, or null when absent. */
function histogram(app: Record<string, any>): { s1: number; s2: number; s3: number; s4: number; s5: number } | null {
  const s1 = num(app.histogram1star);
  const s5 = num(app.histogram5star);
  if (s1 == null && s5 == null) return null;
  return {
    s1: s1 ?? 0,
    s2: num(app.histogram2star) ?? 0,
    s3: num(app.histogram3star) ?? 0,
    s4: num(app.histogram4star) ?? 0,
    s5: s5 ?? 0,
  };
}

export const googlePlayHandler: KindHandler = {
  isReviewItem,
  normalizeReview,
  summarize(items, dayReviews): DaySummary {
    const app = items.find((i) => i.ratings != null || i.score != null) ?? {};
    const dist = histogram(app);

    // Prefer the store histogram for sentiment (lifetime, robust); fall back to
    // the day's review sample if a details item wasn't returned.
    let pos: number | null = null;
    let neg: number | null = null;
    if (dist) {
      const total = dist.s1 + dist.s2 + dist.s3 + dist.s4 + dist.s5;
      if (total > 0) {
        pos = Math.round(((dist.s4 + dist.s5) / total) * 1000) / 10;
        neg = Math.round((100 - pos) * 10) / 10;
      }
    } else {
      ({ pos, neg } = sentimentShare(dayReviews));
    }

    return {
      rating: num(app.score),
      reviewCount: num(app.ratings) ?? num(app.reviews),
      pos,
      neg,
      raw: dist || app.version != null ? { dist, version: app.version ?? null, installs: app.installs ?? null } : null,
    };
  },
};
