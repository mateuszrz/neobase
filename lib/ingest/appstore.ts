/**
 * App Store source handler. We scrape the actor's `details` mode with
 * `includeReviews`, so the dataset holds one app-info item (`rating`,
 * `ratingCount`) plus a small sample of newest reviews. Apple exposes no star
 * histogram, so sentiment is derived from the review sample. Apple's RSS reviews
 * carry no reviewer country, so mobile reviews stay global ("ZZ").
 */

import type { KindHandler, NormalizedReview, DaySummary } from "./types";
import { sentimentShare } from "./types";

const num = (v: unknown): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** App-info items carry a total ratingCount; review items carry per-user content. */
export function isReviewItem(item: Record<string, any>): boolean {
  return item.ratingCount == null && (item.reviewId != null || item.content != null || item.author != null);
}

export function normalizeReview(item: Record<string, any>): NormalizedReview {
  const raw = item.date ?? item.updated ?? null;
  return {
    externalId: String(item.reviewId ?? item.id),
    rating: num(item.rating ?? item.score),
    title: item.title ?? null,
    body: item.content ?? item.text ?? null,
    country: "ZZ", // Apple RSS reviews have no reviewer country
    postedAt: raw ? new Date(raw) : null,
    verified: false,
    topics: [],
  };
}

export const appStoreHandler: KindHandler = {
  isReviewItem,
  normalizeReview,
  summarize(items, dayReviews): DaySummary {
    const app = items.find((i) => i.ratingCount != null || i.rating != null) ?? {};
    const s = sentimentShare(dayReviews);
    return {
      rating: num(app.rating),
      reviewCount: num(app.ratingCount),
      pos: s.pos,
      neg: s.neg,
      raw: app.version != null ? { version: app.version, ratingCountCurrentVersion: num(app.ratingCountCurrentVersion) } : null,
    };
  },
};
