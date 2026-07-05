/**
 * Server-side data access for the public directory. Read-only, used by RSC pages.
 */

import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { fintechs, metricSnapshots, reviews } = schema;

export interface FintechListItem {
  id: string;
  name: string;
  country: string | null;
  logoSvg: string | null;
  tags: string[] | null;
  rating: number | null;
  reviewCount: number | null;
}

/** Latest global Trustpilot rating per fintech, joined via LATERAL. */
async function listWithLatest(type: "neobank" | "exchange" | null, limit?: number): Promise<FintechListItem[]> {
  const rows = await db.execute(sql`
    SELECT f.id, f.name, f.country, f.logo_svg AS "logoSvg", f.tags,
           m.rating, m.review_count AS "reviewCount"
    FROM fintechs f
    LEFT JOIN LATERAL (
      SELECT rating, review_count
      FROM metric_snapshots ms
      WHERE ms.fintech_id = f.id AND ms.kind = 'trustpilot' AND ms.country = 'ZZ'
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) m ON true
    ${type ? sql`WHERE f.type = ${type}` : sql``}
    ORDER BY m.rating DESC NULLS LAST, f.name ASC
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    logoSvg: r.logoSvg,
    tags: r.tags,
    rating: r.rating == null ? null : Number(r.rating),
    reviewCount: r.reviewCount == null ? null : Number(r.reviewCount),
  }));
}

export const getTopNeobanks = (limit = 12) => listWithLatest("neobank", limit);
export const getTopExchanges = (limit = 8) => listWithLatest("exchange", limit);
export const getAllFintechs = () => listWithLatest(null);
export const listNeobanks = () => listWithLatest("neobank");
export const listExchanges = () => listWithLatest("exchange");

export async function getPlatformStats() {
  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM fintechs)::int AS fintechs,
      (SELECT count(*) FROM reviews)::int AS reviews,
      (SELECT count(DISTINCT country) FROM metric_snapshots WHERE country <> 'ZZ')::int AS countries
  `);
  const r = (rows.rows as any[])[0] ?? {};
  return { fintechs: Number(r.fintechs ?? 0), reviews: Number(r.reviews ?? 0), countries: Number(r.countries ?? 0) };
}

export async function getFintech(slug: string) {
  const [row] = await db.select().from(fintechs).where(eq(fintechs.id, slug)).limit(1);
  return row ?? null;
}

export interface SeriesPoint {
  date: string;
  rating: number | null;
  count: number | null;
  pos: number | null;
}

export async function getSeries(fintechId: string): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: metricSnapshots.snapshotDate,
      rating: metricSnapshots.rating,
      count: metricSnapshots.reviewCount,
      pos: metricSnapshots.sentimentPos,
    })
    .from(metricSnapshots)
    .where(
      and(
        eq(metricSnapshots.fintechId, fintechId),
        eq(metricSnapshots.kind, "trustpilot"),
        eq(metricSnapshots.country, "ZZ"),
      ),
    )
    .orderBy(asc(metricSnapshots.snapshotDate));
  return rows.map((r) => ({
    date: String(r.date),
    rating: r.rating == null ? null : Number(r.rating),
    count: r.count == null ? null : Number(r.count),
    pos: r.pos == null ? null : Number(r.pos),
  }));
}

export async function getRecentReviews(fintechId: string, limit = 10) {
  return db
    .select({
      country: reviews.country,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      postedAt: reviews.postedAt,
    })
    .from(reviews)
    .where(eq(reviews.fintechId, fintechId))
    .orderBy(desc(reviews.postedAt))
    .limit(limit);
}

export interface CountryRow {
  country: string;
  rating: number | null;
  count: number | null;
  pos: number | null;
}

/** Latest per-country Trustpilot snapshot (segmentation by reviewer origin). */
export async function getCountryBreakdown(fintechId: string): Promise<CountryRow[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (country) country, rating, review_count AS "count", sentiment_pos AS "pos"
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND kind = 'trustpilot' AND country <> 'ZZ'
    ORDER BY country, snapshot_date DESC
  `);
  return (rows.rows as any[])
    .map((r) => ({
      country: r.country,
      rating: r.rating == null ? null : Number(r.rating),
      count: r.count == null ? null : Number(r.count),
      pos: r.pos == null ? null : Number(r.pos),
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
}
