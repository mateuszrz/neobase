/**
 * Google Play source handler. We scrape the actor's `details` mode, which returns
 * a single app-info item carrying the store aggregate: `score` (rating),
 * `ratings` (lifetime rating count) and the 1–5★ `histogramNstar` breakdown — so
 * rating, volume AND sentiment all come from the store listing, with no
 * individual reviews and no PII.
 */

import type { KindHandler, NormalizedReview, DaySummary, Dist } from "./types";
import { distSentiment } from "./types";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 1–5★ distribution from the app-info item's histogramNstar fields. */
function histogram(app: Record<string, any>): Dist | null {
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
  isReviewItem: () => false, // details mode returns only the app-info item
  normalizeReview: (): NormalizedReview => {
    throw new Error("google play details mode returns no reviews");
  },
  summarize(items): DaySummary {
    const app = items.find((i) => i.ratings != null || i.score != null) ?? {};
    const dist = histogram(app);
    const s = dist ? distSentiment(dist) : { pos: null, neg: null };
    return {
      rating: num(app.score),
      reviewCount: num(app.ratings) ?? num(app.reviews),
      pos: s.pos,
      neg: s.neg,
      raw: dist || app.version != null ? { dist, version: app.version ?? null, installs: app.installs ?? null } : null,
    };
  },
};
