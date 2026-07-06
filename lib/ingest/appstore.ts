/**
 * App Store source handler. We scrape `logiover/app-store-data-api` in `ratings`
 * mode, which returns the app's all-time rating count + 1–5★ histogram in one
 * tiny item — no individual reviews, no PII. Apple exposes no average rating, so
 * we compute it from the histogram; sentiment comes from the same distribution.
 */

import type { KindHandler, NormalizedReview, DaySummary, Dist } from "./types";
import { distAverage, distSentiment } from "./types";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** 1–5★ distribution from the actor's `histogram` object ({ "1": n, … "5": n }). */
function ratingsDist(item: Record<string, any>): Dist | null {
  const h = item.histogram;
  if (!h || typeof h !== "object") return null;
  const s1 = num(h["1"]);
  const s5 = num(h["5"]);
  if (s1 == null && s5 == null) return null;
  return { s1: s1 ?? 0, s2: num(h["2"]) ?? 0, s3: num(h["3"]) ?? 0, s4: num(h["4"]) ?? 0, s5: s5 ?? 0 };
}

export const appStoreHandler: KindHandler = {
  isReviewItem: () => false, // ratings mode returns no review items
  normalizeReview: (): NormalizedReview => {
    throw new Error("app store ratings mode returns no reviews");
  },
  summarize(items): DaySummary {
    const app = items.find((i) => i.histogram != null || i.ratings != null) ?? {};
    const dist = ratingsDist(app);
    const s = dist ? distSentiment(dist) : { pos: null, neg: null };
    return {
      rating: dist ? distAverage(dist) : num(app.rating),
      reviewCount: num(app.ratings) ?? num(app.ratingCount),
      pos: s.pos,
      neg: s.neg,
      raw: dist ? { dist } : null,
    };
  },
};
