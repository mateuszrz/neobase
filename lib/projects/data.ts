/**
 * Read layer for a project's collected intelligence — the value a paid customer
 * sees. A project tracks brands × markets; the daily-project track collects
 * per-market Trustpilot/store snapshots + homepage change diffs into the SHARED
 * source set. This assembles that into a brand × market signals matrix (latest
 * rating / sentiment / volume + Δ vs the prior snapshot) plus a recent-changes
 * feed. Empty cells read as "collecting" until the daily run fills them.
 */

import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

function inArrayOrNever(col: Parameters<typeof inArray>[0], values: string[]) {
  return values.length ? inArray(col, values) : sql`false`;
}

const { projectBrands, projectMarkets, fintechs, metricSnapshots, contentChanges } = schema;

export interface MarketSignal {
  country: string;
  rating: number | null;
  count: number | null;
  pos: number | null; // % positive sentiment
  delta: number | null; // rating change vs prior snapshot
}
export interface BrandSignals {
  id: string;
  name: string;
  logoSvg: string | null;
  markets: MarketSignal[]; // one per project market (rating null = not collected yet)
}
export interface ProjectChange {
  fintechId: string;
  name: string;
  country: string;
  summary: string | null;
  changeKinds: string[];
  toDate: string;
}
export interface ProjectSignals {
  brands: BrandSignals[];
  markets: string[];
  changes: ProjectChange[];
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface BrandTrend {
  id: string;
  name: string;
  logoSvg: string | null;
  points: { week: string; composite: number }[]; // weekly composite sentiment, oldest→newest
}

/**
 * Per-brand weekly composite-sentiment trend for a project's tracked brands
 * (last `weeks` points from sentiment_index). Powers the sparklines in the
 * project view — a visual read of where each brand is heading, WoW.
 */
export async function getProjectTrend(projectId: string, weeks = 12): Promise<BrandTrend[]> {
  const brandRows = await db
    .select({ id: projectBrands.fintechId, name: fintechs.name, logoSvg: fintechs.logoSvg })
    .from(projectBrands)
    .innerJoin(fintechs, eq(fintechs.id, projectBrands.fintechId))
    .where(eq(projectBrands.projectId, projectId));
  const brandIds = brandRows.map((b) => b.id);
  if (!brandIds.length) return [];

  const rows = await db.execute(sql`
    SELECT fintech_id AS "fintechId", week, composite
    FROM sentiment_index
    WHERE fintech_id IN ${brandIds}
      AND week >= current_date - (${weeks * 7} * interval '1 day')
    ORDER BY fintech_id, week ASC
  `);
  const byBrand = new Map<string, { week: string; composite: number }[]>();
  for (const r of rows.rows as any[]) {
    const arr = byBrand.get(r.fintechId) ?? [];
    const c = num(r.composite);
    if (c != null) arr.push({ week: String(r.week).slice(0, 10), composite: c });
    byBrand.set(r.fintechId, arr);
  }
  return brandRows.map((b) => ({ ...b, points: byBrand.get(b.id) ?? [] }));
}

export async function getProjectSignals(projectId: string): Promise<ProjectSignals> {
  const [brandRows, marketRows] = await Promise.all([
    db
      .select({ id: projectBrands.fintechId, name: fintechs.name, logoSvg: fintechs.logoSvg })
      .from(projectBrands)
      .innerJoin(fintechs, eq(fintechs.id, projectBrands.fintechId))
      .where(eq(projectBrands.projectId, projectId)),
    db.select({ country: projectMarkets.country }).from(projectMarkets).where(eq(projectMarkets.projectId, projectId)),
  ]);

  const brandIds = brandRows.map((b) => b.id);
  const markets = marketRows.map((m) => m.country);
  if (!brandIds.length || !markets.length) {
    return { brands: brandRows.map((b) => ({ ...b, markets: [] })), markets, changes: [] };
  }

  // Latest + prior Trustpilot snapshot per (brand, market) → rating/sentiment/volume + Δ.
  const sig = await db.execute(sql`
    WITH ranked AS (
      SELECT fintech_id, country, snapshot_date, rating, review_count, sentiment_pos,
             row_number() OVER (PARTITION BY fintech_id, country ORDER BY snapshot_date DESC) AS rn
      FROM metric_snapshots
      WHERE kind = 'trustpilot' AND fintech_id IN ${brandIds} AND country IN ${markets}
    )
    SELECT fintech_id AS "fintechId", country,
           max(rating)         FILTER (WHERE rn = 1) AS rating,
           max(review_count)   FILTER (WHERE rn = 1) AS count,
           max(sentiment_pos)  FILTER (WHERE rn = 1) AS pos,
           max(rating)         FILTER (WHERE rn = 2) AS prev_rating
    FROM ranked WHERE rn <= 2
    GROUP BY fintech_id, country
  `);
  const byKey = new Map<string, any>();
  for (const r of sig.rows as any[]) byKey.set(`${r.fintechId}:${r.country}`, r);

  const brands: BrandSignals[] = brandRows.map((b) => ({
    ...b,
    markets: markets.map((country) => {
      const r = byKey.get(`${b.id}:${country}`);
      const rating = num(r?.rating);
      const prev = num(r?.prev_rating);
      return {
        country,
        rating,
        count: num(r?.count),
        pos: num(r?.pos),
        delta: rating != null && prev != null ? Math.round((rating - prev) * 100) / 100 : null,
      };
    }),
  }));

  const nameById = new Map(brandRows.map((b) => [b.id, b.name]));
  const chg = await db
    .select({
      fintechId: contentChanges.fintechId,
      country: contentChanges.country,
      summary: contentChanges.summary,
      changeKinds: contentChanges.changeKinds,
      toDate: contentChanges.toDate,
    })
    .from(contentChanges)
    .where(inArrayOrNever(contentChanges.fintechId, brandIds))
    .orderBy(desc(contentChanges.toDate))
    .limit(8);

  const changes: ProjectChange[] = chg.map((c) => ({
    fintechId: c.fintechId,
    name: nameById.get(c.fintechId) ?? c.fintechId,
    country: c.country,
    summary: c.summary,
    changeKinds: c.changeKinds ?? [],
    toDate: String(c.toDate),
  }));

  return { brands, markets, changes };
}
