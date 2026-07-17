/**
 * NeoBase composite sentiment index.
 *
 * A single 0–100 sentiment score per fintech per week, blending:
 *  - REVIEW sentiment: %positive from the rating histogram across Trustpilot /
 *    Google Play / App Store (global, ZZ), volume-weighted by review count.
 *  - NEWS sentiment: article sentiment (Claude-derived) over a trailing window,
 *    mapped positive=100 / neutral=50 / negative=0.
 *
 * The two are blended by DYNAMIC, EVIDENCE-BASED weights: each side's weight
 * scales with how much data it has (capped at a reference volume) and the two are
 * normalised to sum to 1 — so a brand with lots of reviews and little news leans
 * on reviews, and news only moves the number once there's enough of it. With no
 * news the index equals the review score; with neither, no row is written.
 */

import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { sentimentIndex } = schema;

// Tunables — reference volumes for "full evidence", and the trailing window.
const REVIEW_REF = 1000; // review count that counts as full review-side evidence
const NEWS_REF = 6; // article count that counts as full news-side evidence
const MENTION_REF = 15; // substantive mention count that counts as full mention-side evidence
const NEWS_WINDOW_DAYS = 30;
const MENTION_WINDOW_DAYS = 30;
const REVIEW_KINDS = ["trustpilot", "google_play", "app_store"] as const;

// positive=100 / neutral=50 / negative=0 — shared by news and mention sentiment.
const NEWS_VALUE: Record<string, number> = { positive: 100, neutral: 50, negative: 0 };

export interface SentimentComponents {
  composite: number;
  reviewScore: number | null;
  reviewVolume: number;
  newsScore: number | null;
  newsVolume: number;
  mentionScore: number | null;
  mentionVolume: number;
  reviewWeight: number;
  newsWeight: number;
  mentionWeight: number;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Compute the components + composite as of a date. Null if no data at all. */
export async function computeComponents(fintechId: string, asOf: Date): Promise<SentimentComponents | null> {
  const asOfDate = iso(asOf);

  // Review side: latest snapshot per platform on/before asOf, volume-weighted.
  const rev = await db.execute(sql`
    SELECT DISTINCT ON (kind) kind, sentiment_pos AS pos, review_count AS cnt
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ'
      AND kind IN ('trustpilot','google_play','app_store')
      AND sentiment_pos IS NOT NULL AND snapshot_date <= ${asOfDate}
    ORDER BY kind, snapshot_date DESC
  `);
  let rWeighted = 0;
  let reviewVolume = 0;
  for (const r of rev.rows as any[]) {
    const pos = num(r.pos);
    const cnt = num(r.cnt) ?? 0;
    if (pos == null) continue;
    // A platform with a rating but no count still counts as a small sample.
    const w = cnt > 0 ? cnt : 1;
    rWeighted += pos * w;
    reviewVolume += cnt > 0 ? cnt : 0;
  }
  const reviewDenom = (rev.rows as any[]).reduce((s, r) => s + (num(r.cnt) && num(r.cnt)! > 0 ? num(r.cnt)! : num(r.pos) != null ? 1 : 0), 0);
  const reviewScore = reviewDenom > 0 ? rWeighted / reviewDenom : null;

  // News side: article sentiment over the trailing window.
  const start = new Date(asOf.getTime() - NEWS_WINDOW_DAYS * 86_400_000);
  const news = await db.execute(sql`
    SELECT sentiment, count(*)::int AS n
    FROM news_items
    WHERE fintech_id = ${fintechId} AND sentiment IN ('positive','neutral','negative')
      AND coalesce(published_at, created_at) BETWEEN ${iso(start)} AND ${asOfDate}
    GROUP BY sentiment
  `);
  let newsWeighted = 0;
  let newsVolume = 0;
  for (const r of news.rows as any[]) {
    const n = num(r.n) ?? 0;
    newsWeighted += (NEWS_VALUE[r.sentiment] ?? 50) * n;
    newsVolume += n;
  }
  const newsScore = newsVolume > 0 ? newsWeighted / newsVolume : null;

  // Mention side: third-party mention sentiment (toward the brand) over the window.
  const mStart = new Date(asOf.getTime() - MENTION_WINDOW_DAYS * 86_400_000);
  const men = await db.execute(sql`
    SELECT sentiment, count(*)::int AS n
    FROM mentions
    WHERE fintech_id = ${fintechId} AND sentiment IN ('positive','neutral','negative')
      AND coalesce(posted_at, created_at) >= ${iso(mStart)}
      AND coalesce(posted_at, created_at) <= ${asOf.toISOString()}
    GROUP BY sentiment
  `);
  let mentionWeighted = 0;
  let mentionVolume = 0;
  for (const r of men.rows as any[]) {
    const n = num(r.n) ?? 0;
    mentionWeighted += (NEWS_VALUE[r.sentiment] ?? 50) * n;
    mentionVolume += n;
  }
  const mentionScore = mentionVolume > 0 ? mentionWeighted / mentionVolume : null;

  // Evidence-based weights across the three sources, normalised to sum to 1.
  const rE = reviewScore != null ? Math.min(1, reviewVolume / REVIEW_REF || (reviewDenom > 0 ? 0.15 : 0)) : 0;
  const nE = newsScore != null ? Math.min(1, newsVolume / NEWS_REF) : 0;
  const mE = mentionScore != null ? Math.min(1, mentionVolume / MENTION_REF) : 0;
  const total = rE + nE + mE;
  if (total === 0) return null;
  const reviewWeight = rE / total;
  const newsWeight = nE / total;
  const mentionWeight = mE / total;
  const composite = reviewWeight * (reviewScore ?? 0) + newsWeight * (newsScore ?? 0) + mentionWeight * (mentionScore ?? 0);

  return {
    composite: Math.round(composite * 100) / 100,
    reviewScore: reviewScore == null ? null : Math.round(reviewScore * 100) / 100,
    reviewVolume,
    newsScore: newsScore == null ? null : Math.round(newsScore * 100) / 100,
    newsVolume,
    mentionScore: mentionScore == null ? null : Math.round(mentionScore * 100) / 100,
    mentionVolume,
    reviewWeight: Math.round(reviewWeight * 1000) / 1000,
    newsWeight: Math.round(newsWeight * 1000) / 1000,
    mentionWeight: Math.round(mentionWeight * 1000) / 1000,
  };
}

/** Compute + upsert the index for one fintech for a given week. Returns null if no data. */
export async function upsertSentimentIndex(fintechId: string, week: Date = new Date()): Promise<SentimentComponents | null> {
  const c = await computeComponents(fintechId, week);
  if (!c) return null;
  const w = iso(week);
  await db
    .insert(sentimentIndex)
    .values({
      fintechId,
      week: w,
      composite: String(c.composite),
      reviewScore: c.reviewScore == null ? null : String(c.reviewScore),
      newsScore: c.newsScore == null ? null : String(c.newsScore),
      mentionScore: c.mentionScore == null ? null : String(c.mentionScore),
      reviewVolume: c.reviewVolume,
      newsVolume: c.newsVolume,
      mentionVolume: c.mentionVolume,
      reviewWeight: String(c.reviewWeight),
      newsWeight: String(c.newsWeight),
      mentionWeight: String(c.mentionWeight),
    })
    .onConflictDoUpdate({
      target: [sentimentIndex.fintechId, sentimentIndex.week],
      set: {
        composite: String(c.composite),
        reviewScore: c.reviewScore == null ? null : String(c.reviewScore),
        newsScore: c.newsScore == null ? null : String(c.newsScore),
        mentionScore: c.mentionScore == null ? null : String(c.mentionScore),
        reviewVolume: c.reviewVolume,
        newsVolume: c.newsVolume,
        mentionVolume: c.mentionVolume,
        reviewWeight: String(c.reviewWeight),
        newsWeight: String(c.newsWeight),
        mentionWeight: String(c.mentionWeight),
        updatedAt: new Date(),
      },
    });
  return c;
}

/** Backfill the last N weekly rows for a fintech from historical data (once). */
export async function backfillSentimentIndex(fintechId: string, weeks = 10): Promise<number> {
  let written = 0;
  const now = new Date();
  for (let i = 0; i < weeks; i++) {
    const d = new Date(now.getTime() - i * 7 * 86_400_000);
    const c = await upsertSentimentIndex(fintechId, d);
    if (c) written++;
  }
  return written;
}

// ─── Read for display ────────────────────────────────────────────────────────

export interface SentimentPoint {
  week: string;
  composite: number;
}
export interface SentimentIndexView {
  latest: {
    composite: number;
    reviewScore: number | null;
    newsScore: number | null;
    mentionScore: number | null;
    reviewWeight: number;
    newsWeight: number;
    mentionWeight: number;
    reviewVolume: number;
    newsVolume: number;
    mentionVolume: number;
    week: string;
  };
  deltaWoW: number | null; // composite change vs the prior stored week
  series: SentimentPoint[]; // chronological, for the trend
}

export async function getSentimentIndex(fintechId: string): Promise<SentimentIndexView | null> {
  const rows = await db
    .select()
    .from(sentimentIndex)
    .where(eq(sentimentIndex.fintechId, fintechId))
    .orderBy(desc(sentimentIndex.week))
    .limit(16);
  if (!rows.length) return null;

  const [latest, prev] = rows;
  const series: SentimentPoint[] = [...rows]
    .reverse()
    .map((r) => ({ week: String(r.week), composite: Number(r.composite) }));

  return {
    latest: {
      composite: Number(latest.composite),
      reviewScore: latest.reviewScore == null ? null : Number(latest.reviewScore),
      newsScore: latest.newsScore == null ? null : Number(latest.newsScore),
      mentionScore: latest.mentionScore == null ? null : Number(latest.mentionScore),
      reviewWeight: latest.reviewWeight == null ? 0 : Number(latest.reviewWeight),
      newsWeight: latest.newsWeight == null ? 0 : Number(latest.newsWeight),
      mentionWeight: latest.mentionWeight == null ? 0 : Number(latest.mentionWeight),
      reviewVolume: latest.reviewVolume ?? 0,
      newsVolume: latest.newsVolume ?? 0,
      mentionVolume: latest.mentionVolume ?? 0,
      week: String(latest.week),
    },
    deltaWoW: prev ? Math.round((Number(latest.composite) - Number(prev.composite)) * 100) / 100 : null,
    series,
  };
}
