/**
 * Server-side data access for the public directory. Read-only, used by RSC pages.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

import { sampleSocialPosts, type SocialPostView } from "@/lib/social/sample";
import { sampleNews, type NewsItemView, type NewsSentiment } from "@/lib/news/sample";
import { sampleBlogPosts, type BlogPostView } from "@/lib/blog/sample";
import { sampleMentions, type MentionView } from "@/lib/mentions/sample";
import { gatherContext, getStoredSummary } from "@/lib/summary/generate";
import { composeBrief } from "@/lib/summary/compose";

const { fintechs, metricSnapshots, reviews, socialPosts, newsItems, blogPosts, mentions, caspProviders } = schema;

/** Whether the per-field confidence audit marked HQ country as trustworthy.
 *  jsonb comes back parsed (object) on Neon, but tolerate a string too. */
function confidentCountry(fc: unknown): boolean {
  if (!fc) return false;
  const obj = typeof fc === "string" ? safeJson(fc) : fc;
  return !!obj && typeof obj === "object" && (obj as any).country === "high";
}
function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

export interface FintechListItem {
  id: string;
  name: string;
  country: string | null;
  logoSvg: string | null;
  website: string | null;
  tags: string[] | null;
  rating: number | null;
  reviewCount: number | null;
  sentiment: number | null; // our composite sentiment score (only populated when ranked by it)
  featured: boolean; // editor's pick — pinned above rank 1, no number, "Featured" badge
}

/**
 * Latest Trustpilot rating + our composite sentiment per fintech (LATERAL joins).
 * `rankBy` picks the ordering: "rating" (TrustScore) or "sentiment" (our score);
 * the `sentiment` field is only surfaced when ranking by it.
 */
async function listWithLatest(
  type: "neobank" | "exchange" | null,
  limit?: number,
  rankBy: "rating" | "sentiment" = "rating",
): Promise<FintechListItem[]> {
  const order =
    rankBy === "sentiment"
      ? sql`ORDER BY f.featured DESC, si.composite DESC NULLS LAST, m.rating DESC NULLS LAST, f.name ASC`
      : sql`ORDER BY f.featured DESC, m.rating DESC NULLS LAST, f.name ASC`;
  const rows = await db.execute(sql`
    SELECT f.id, f.name, f.country, f.logo_svg AS "logoSvg", f.website, f.tags, f.featured,
           f.fact_confidence AS "factConfidence",
           m.rating, tot.total AS "reviewCount", si.composite AS sentiment
    FROM fintechs f
    LEFT JOIN LATERAL (
      SELECT rating, review_count
      FROM metric_snapshots ms
      WHERE ms.fintech_id = f.id AND ms.kind = 'trustpilot' AND ms.country = 'ZZ'
      ORDER BY snapshot_date DESC
      LIMIT 1
    ) m ON true
    -- Total review count = sum of the latest LIVE count per platform, matching
    -- the profile's total and the sentiment volume. Trustpilot alone (what this
    -- used to show) undercounts; the seeded history (raw NULL) overcounts.
    LEFT JOIN LATERAL (
      SELECT coalesce(sum(cnt), 0)::bigint AS total FROM (
        SELECT DISTINCT ON (kind) review_count AS cnt
        FROM metric_snapshots ms3
        WHERE ms3.fintech_id = f.id AND ms3.country = 'ZZ'
          AND ms3.kind IN ('trustpilot','google_play','app_store')
          AND ms3.review_count IS NOT NULL AND ms3.raw IS NOT NULL
        ORDER BY kind, snapshot_date DESC
      ) x
    ) tot ON true
    LEFT JOIN LATERAL (
      SELECT composite FROM sentiment_index s WHERE s.fintech_id = f.id ORDER BY week DESC LIMIT 1
    ) si ON true
    ${type ? sql`WHERE f.type = ${type}` : sql``}
    ${order}
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: r.id,
    name: r.name,
    // Trust gate: only surface HQ country when the confidence audit cleared it.
    country: confidentCountry(r.factConfidence) ? r.country : null,
    logoSvg: r.logoSvg,
    website: r.website ?? null,
    tags: r.tags,
    rating: r.rating == null ? null : Number(r.rating),
    reviewCount: r.reviewCount == null ? null : Number(r.reviewCount),
    sentiment: rankBy === "sentiment" && r.sentiment != null ? Number(r.sentiment) : null,
    featured: r.featured ?? false,
  }));
}

// Both rank by OUR composite sentiment score (and surface it on the cards) — it's
// the product's own signal, not a third-party rating. Falls back to the Trustpilot
// rating only for brands without a score yet (NULLS LAST keeps those off the top).
export const getTopNeobanks = (limit = 12) => listWithLatest("neobank", limit, "sentiment");
export const getTopExchanges = (limit = 8) => listWithLatest("exchange", limit, "sentiment");
export const getAllFintechs = () => listWithLatest(null);
// Both directories rank by (and surface) our composite sentiment score, not a
// third-party TrustScore — consistent with the homepage and the product's signal.
export const listNeobanks = () => listWithLatest("neobank", undefined, "sentiment");
export const listExchanges = () => listWithLatest("exchange", undefined, "sentiment");

export async function getPlatformStats() {
  // "Ratings" = the aggregate volume behind the scores (we hold anonymised store
  // aggregates, not individual reviews) — sum the latest count per fintech×platform.
  const rows = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM fintechs)::int AS fintechs,
      (SELECT coalesce(sum(cnt), 0)::bigint FROM (
        SELECT DISTINCT ON (fintech_id, kind) review_count AS cnt
        FROM metric_snapshots
        WHERE country = 'ZZ' AND kind IN ('trustpilot','google_play','app_store')
          AND review_count IS NOT NULL AND raw IS NOT NULL
        ORDER BY fintech_id, kind, snapshot_date DESC
      ) t) AS ratings,
      (SELECT count(DISTINCT country) FROM metric_snapshots WHERE country <> 'ZZ')::int AS countries
  `);
  const r = (rows.rows as any[])[0] ?? {};
  return { fintechs: Number(r.fintechs ?? 0), ratings: Number(r.ratings ?? 0), countries: Number(r.countries ?? 0) };
}

/**
 * A directory entry, with prose overlaid in the reader's language when we have
 * it.
 *
 * The English row stays canonical: `fact_confidence` is read from it and is
 * never re-derived per language, because confidence is a property of the FACT,
 * not of the wording. A description the trust gate hid in English stays hidden
 * in every language; a translation can never promote something to visible.
 *
 * Falls back to English field by field, so a partially translated row degrades
 * gracefully instead of blanking.
 */
export async function getFintech(slug: string, locale?: string) {
  const [row] = await db.select().from(fintechs).where(eq(fintechs.id, slug)).limit(1);
  if (!row) return null;
  if (!locale || locale === "en") return row;

  const [tr] = await db
    .select()
    .from(schema.fintechTranslations)
    .where(and(eq(schema.fintechTranslations.fintechId, slug), eq(schema.fintechTranslations.locale, locale)))
    .limit(1);
  if (!tr) return row;

  return {
    ...row,
    description: tr.description ?? row.description,
    about: tr.about ?? row.about,
    // FAQ order is load-bearing: fact_confidence.faqs is an array aligned to it
    // by index, so a translation that reorders or drops entries would shift the
    // gate onto the wrong answers. Only accept a same-length array.
    faqs:
      Array.isArray(tr.faqs) && Array.isArray(row.faqs) && (tr.faqs as unknown[]).length === (row.faqs as unknown[]).length
        ? tr.faqs
        : row.faqs,
  };
}

export interface SeriesPoint {
  date: string;
  rating: number | null;
  count: number | null;
  pos: number | null;
}

/**
 * Live Trustpilot time-series — only snapshots produced by the pipeline (they
 * carry a `raw` payload), never the uncertain seeded monthly history. One point
 * per day; the series grows as the daily cron runs, powering real trends.
 */
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
        isNotNull(metricSnapshots.raw),
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

export interface PlatformSeries {
  kind: string;
  points: { date: string; pos: number }[];
}

/**
 * Live positive-sentiment series per platform (Trustpilot / Google Play / App
 * Store), for the per-platform sentiment trend. Live snapshots only.
 */
export async function getPlatformSentimentSeries(fintechId: string): Promise<PlatformSeries[]> {
  const rows = await db.execute(sql`
    SELECT kind, snapshot_date::text AS date, sentiment_pos AS pos
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ'
      AND kind IN ('trustpilot', 'google_play', 'app_store')
      AND raw IS NOT NULL AND sentiment_pos IS NOT NULL
    ORDER BY kind, snapshot_date
  `);
  const order = ["trustpilot", "google_play", "app_store"];
  const byKind = new Map<string, { date: string; pos: number }[]>();
  for (const r of rows.rows as any[]) {
    const arr = byKind.get(r.kind) ?? [];
    arr.push({ date: String(r.date).slice(0, 10), pos: Number(r.pos) });
    byKind.set(r.kind, arr);
  }
  return order.filter((k) => byKind.has(k)).map((k) => ({ kind: k, points: byKind.get(k)! }));
}

export interface ProfileExtras {
  dist: { s1: number; s2: number; s3: number; s4: number; s5: number } | null;
  responseRate: number | null;
  responseTime: string | number | null;
  aiSummary: string | null;
  verifiedRatio: number | null;
  topics: { t: string; c: number }[];
}

/** Company-level extras from the latest global Trustpilot snapshot's raw column. */
export async function getProfileExtras(fintechId: string): Promise<ProfileExtras | null> {
  const rows = await db.execute(sql`
    SELECT raw FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND kind = 'trustpilot' AND country = 'ZZ' AND raw IS NOT NULL
    ORDER BY snapshot_date DESC
    LIMIT 1
  `);
  const raw = (rows.rows as any[])[0]?.raw;
  if (!raw) return null;
  return {
    dist: raw.dist ?? null,
    responseRate: raw.responseRate ?? null,
    responseTime: raw.responseTime ?? null,
    aiSummary: raw.aiSummary ?? null,
    verifiedRatio: raw.verifiedRatio ?? null,
    topics: Array.isArray(raw.topics) ? raw.topics : [],
  };
}

export interface PlatformRating {
  kind: string; // trustpilot | google_play | app_store
  rating: number | null;
  count: number | null;
  pos: number | null;
  installs: string | null; // Google Play install band, e.g. "10,000,000+"
}

/**
 * Latest global (ZZ) rating per platform for the cross-platform tile row.
 * Returns one row per kind that has data, in a stable display order.
 */
export async function getPlatformRatings(fintechId: string): Promise<PlatformRating[]> {
  // Only recent (live-pipeline) snapshots — never the seeded monthly history, so
  // a platform tile reflects a real current scrape, not stale app.js data.
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (kind) kind, rating, review_count AS "count", sentiment_pos AS "pos",
           raw->>'installs' AS installs
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ'
      AND kind IN ('trustpilot', 'google_play', 'app_store') AND rating IS NOT NULL
      AND snapshot_date >= current_date - interval '14 days'
    ORDER BY kind, snapshot_date DESC
  `);
  const order = ["trustpilot", "google_play", "app_store"];
  return (rows.rows as any[])
    .map((r) => ({
      kind: r.kind,
      rating: r.rating == null ? null : Number(r.rating),
      count: r.count == null ? null : Number(r.count),
      pos: r.pos == null ? null : Number(r.pos),
      installs: r.installs ?? null,
    }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
}

export interface AppLinks {
  googlePlay: string | null; // Google Play package id
  appStore: string | null; // App Store numeric id
}

/** Store ids for the app-download links, from the active mobile sources. */
export async function getAppLinks(fintechId: string): Promise<AppLinks> {
  const rows = await db
    .select({ kind: schema.sources.kind, ref: schema.sources.externalRef })
    .from(schema.sources)
    .where(and(eq(schema.sources.fintechId, fintechId), eq(schema.sources.active, true), inArray(schema.sources.kind, ["google_play", "app_store"])));
  return {
    googlePlay: rows.find((r) => r.kind === "google_play")?.ref ?? null,
    appStore: rows.find((r) => r.kind === "app_store")?.ref ?? null,
  };
}

export interface RatingDist {
  dist: { s1: number; s2: number; s3: number; s4: number; s5: number };
  sources: string[]; // platforms summed into the distribution (trustpilot | google_play | app_store)
}

/**
 * Aggregate 1–5★ distribution across ALL platforms: the latest snapshot per
 * source (Trustpilot, Google Play, App Store) summed star-by-star, so the chart
 * reflects total review volume rather than a single store.
 */
export async function getRatingDistribution(fintechId: string): Promise<RatingDist | null> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (kind) kind, raw->'dist' AS dist
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ'
      AND kind IN ('trustpilot','google_play','app_store')
      AND jsonb_typeof(raw->'dist') = 'object'
      AND snapshot_date >= current_date - interval '14 days'
    ORDER BY kind, snapshot_date DESC
  `);
  const list = rows.rows as any[];
  const dist = { s1: 0, s2: 0, s3: 0, s4: 0, s5: 0 };
  const sources: string[] = [];
  const order = ["trustpilot", "google_play", "app_store"];
  for (const r of list) {
    const d = r.dist;
    if (!d) continue;
    dist.s1 += Number(d.s1) || 0;
    dist.s2 += Number(d.s2) || 0;
    dist.s3 += Number(d.s3) || 0;
    dist.s4 += Number(d.s4) || 0;
    dist.s5 += Number(d.s5) || 0;
    sources.push(r.kind);
  }
  if (!sources.length) return null;
  sources.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { dist, sources };
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

/**
 * Social feed for the profile. Real Apify-ingested posts if any exist; otherwise
 * a deterministic labelled SAMPLE so the page shows the design (never persisted).
 */
export async function getSocialPosts(
  fintechId: string,
  name: string,
  limit = 4,
): Promise<{ posts: SocialPostView[]; isSample: boolean }> {
  const rows = await db
    .select({
      network: socialPosts.network,
      text: socialPosts.text,
      postedAt: socialPosts.postedAt,
      likes: socialPosts.likes,
      comments: socialPosts.comments,
      shares: socialPosts.shares,
      url: socialPosts.url,
    })
    .from(socialPosts)
    .where(eq(socialPosts.fintechId, fintechId))
    .orderBy(desc(socialPosts.postedAt))
    .limit(limit);

  if (rows.length) {
    return {
      isSample: false,
      posts: rows.map((r) => ({
        network: (r.network === "facebook" ? "facebook" : "linkedin") as SocialPostView["network"],
        text: r.text ?? "",
        postedAt: r.postedAt ? new Date(r.postedAt).toISOString() : new Date().toISOString(),
        likes: r.likes ?? 0,
        comments: r.comments ?? 0,
        shares: r.shares ?? 0,
        url: r.url,
      })),
    };
  }
  return { posts: sampleSocialPosts(fintechId, name, limit), isSample: true };
}

/**
 * Weekly AI brief for the profile. The stored (Claude-written, refreshed weekly)
 * brief if one exists; otherwise a deterministic SAMPLE composed from real
 * ratings/sentiment plus the same sample news shown below — labelled "Sample".
 */
export async function getAiSummary(
  fintechId: string,
  name: string,
): Promise<{ text: string; updatedAt: Date | null; isSample: boolean }> {
  const stored = await getStoredSummary(fintechId);
  if (stored) return { text: stored.text, updatedAt: stored.updatedAt, isSample: false };

  const ctx = await gatherContext(fintechId);
  if (!ctx.news.length) {
    ctx.news = sampleNews(fintechId, name, 5).map((n) => ({ title: n.title, sentiment: n.sentiment }));
  }
  return { text: composeBrief(name, ctx), updatedAt: null, isSample: true };
}

/** Best-effort publisher domain for a favicon: from the article URL, else a
 * publisher string that already looks like a domain. */
function domainOf(url: string | null, publisher: string | null): string | null {
  if (url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      /* fall through */
    }
  }
  if (publisher && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(publisher)) return publisher.toLowerCase();
  return null;
}

/** News/media coverage. Real DataForSEO items if any, else labelled SAMPLE. */
export async function getNews(
  fintechId: string,
  name: string,
  limit = 5,
): Promise<{ items: NewsItemView[]; isSample: boolean }> {
  const rows = await db
    .select({
      title: newsItems.title,
      publisher: newsItems.publisher,
      publishedAt: newsItems.publishedAt,
      snippet: newsItems.snippet,
      sentiment: newsItems.sentiment,
      url: newsItems.url,
    })
    .from(newsItems)
    .where(eq(newsItems.fintechId, fintechId))
    .orderBy(desc(newsItems.publishedAt))
    .limit(limit);

  if (rows.length) {
    return {
      isSample: false,
      items: rows.map((r) => ({
        title: r.title,
        publisher: r.publisher ?? "",
        domain: domainOf(r.url, r.publisher),
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : new Date().toISOString(),
        snippet: r.snippet ?? "",
        sentiment: (["positive", "neutral", "negative"].includes(r.sentiment ?? "") ? r.sentiment : "neutral") as NewsSentiment,
        url: r.url,
      })),
    };
  }
  return { items: sampleNews(fintechId, name, limit), isSample: true };
}

/** Company blog posts. Real crawled posts if any, else labelled SAMPLE. */
export async function getBlogPosts(
  fintechId: string,
  name: string,
  limit = 4,
): Promise<{ posts: BlogPostView[]; isSample: boolean }> {
  const rows = await db
    .select({ title: blogPosts.title, url: blogPosts.url, publishedAt: blogPosts.publishedAt, snippet: blogPosts.snippet })
    .from(blogPosts)
    .where(eq(blogPosts.fintechId, fintechId))
    .orderBy(desc(blogPosts.publishedAt))
    .limit(limit);

  if (rows.length) {
    return {
      isSample: false,
      posts: rows.map((r) => ({
        title: r.title,
        url: r.url,
        publishedAt: r.publishedAt ? new Date(r.publishedAt).toISOString() : new Date().toISOString(),
        snippet: r.snippet ?? "",
      })),
    };
  }
  return { posts: sampleBlogPosts(fintechId, name, limit), isSample: true };
}

/**
 * Third-party mentions of the brand across X / LinkedIn / Facebook. Real search-
 * ingested rows if any exist, otherwise a deterministic labelled SAMPLE.
 */
export async function getMentions(
  fintechId: string,
  name: string,
  limit = 5,
): Promise<{ items: MentionView[]; isSample: boolean }> {
  const rows = await db
    .select({
      network: mentions.network,
      authorName: mentions.authorName,
      authorHandle: mentions.authorHandle,
      text: mentions.text,
      postedAt: mentions.postedAt,
      sentiment: mentions.sentiment,
      url: mentions.url,
    })
    .from(mentions)
    .where(eq(mentions.fintechId, fintechId))
    .orderBy(desc(mentions.postedAt))
    .limit(limit);

  if (rows.length) {
    return {
      isSample: false,
      items: rows.map((r) => ({
        network: (r.network === "reddit" || r.network === "facebook" ? r.network : "x") as MentionView["network"],
        authorName: r.authorName ?? "Someone",
        authorHandle: r.authorHandle,
        text: r.text ?? "",
        postedAt: r.postedAt ? new Date(r.postedAt).toISOString() : new Date().toISOString(),
        sentiment: (["positive", "neutral", "negative"].includes(r.sentiment ?? "") ? r.sentiment : "neutral") as MentionView["sentiment"],
        url: r.url,
      })),
    };
  }
  return { items: sampleMentions(fintechId, name, limit), isSample: true };
}

export interface MicaStatus {
  licensed: boolean;
  provider: string | null;
  legalEntity: string | null;
  country: string | null;
  regulator: string | null;
  services: string[];
  website: string | null;
}

/** MiCA/ESMA CASP registry status for a fintech (matched at seed time). */
export async function getMicaStatus(fintechId: string): Promise<MicaStatus> {
  const [row] = await db
    .select({
      caspId: fintechs.caspProviderId,
      provider: caspProviders.provider,
      legalEntity: caspProviders.legalEntity,
      country: caspProviders.country,
      regulator: caspProviders.regulator,
      services: caspProviders.services,
      website: caspProviders.website,
    })
    .from(fintechs)
    .leftJoin(caspProviders, eq(fintechs.caspProviderId, caspProviders.id))
    .where(eq(fintechs.id, fintechId))
    .limit(1);
  if (!row || row.caspId == null) return { licensed: false, provider: null, legalEntity: null, country: null, regulator: null, services: [], website: null };
  return {
    licensed: true,
    provider: row.provider,
    legalEntity: row.legalEntity,
    country: row.country,
    regulator: row.regulator,
    services: row.services ?? [],
    website: row.website,
  };
}

export interface BestRow {
  id: string;
  name: string;
  country: string | null;
  logoSvg: string | null;
  website: string | null;
  sentiment: number | null;
  rating: number | null;
  reviewCount: number | null;
  tags: string[] | null;
  featured: boolean; // editor's pick — pinned above rank 1 in the ranking
}

/** Fintechs of a type whose tags overlap `match`, ranked by our sentiment score. */
export async function getBestForTag(match: string[], group: "neobank" | "exchange", limit = 60): Promise<BestRow[]> {
  const rows = await db.execute(sql`
    SELECT f.id, f.name, f.country, f.logo_svg AS "logoSvg", f.website, f.tags, f.featured,
           f.fact_confidence AS "factConfidence",
           si.composite AS sentiment, m.rating, m.review_count AS "reviewCount"
    FROM fintechs f
    LEFT JOIN LATERAL (SELECT composite FROM sentiment_index s WHERE s.fintech_id = f.id ORDER BY week DESC LIMIT 1) si ON true
    LEFT JOIN LATERAL (
      SELECT rating, review_count FROM metric_snapshots ms
      WHERE ms.fintech_id = f.id AND ms.kind = 'trustpilot' AND ms.country = 'ZZ'
      ORDER BY snapshot_date DESC LIMIT 1
    ) m ON true
    WHERE f.type = ${group} AND f.tags && ARRAY[${sql.join(match.map((m) => sql`${m}`), sql`, `)}]::text[]
    ORDER BY f.featured DESC, si.composite DESC NULLS LAST, m.rating DESC NULLS LAST, f.name ASC
    LIMIT ${limit}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: r.id, name: r.name, country: confidentCountry(r.factConfidence) ? r.country : null, logoSvg: r.logoSvg, website: r.website ?? null,
    sentiment: r.sentiment == null ? null : Number(r.sentiment),
    rating: r.rating == null ? null : Number(r.rating),
    reviewCount: r.reviewCount == null ? null : Number(r.reviewCount),
    tags: r.tags ?? null,
    featured: r.featured ?? false,
  }));
}

/** Count of fintechs matching each raw tag (for the rankings index). */
export async function getTagCounts(): Promise<Map<string, number>> {
  const rows = await db.execute(sql`SELECT type, unnest(tags) AS tag, count(*)::int AS n FROM fintechs GROUP BY type, tag`);
  const m = new Map<string, number>();
  for (const r of rows.rows as any[]) m.set(`${r.type}:${r.tag}`, Number(r.n));
  return m;
}

export interface MicaRegistryRow {
  id: number;
  provider: string;
  legalEntity: string | null;
  country: string;
  regulator: string;
  services: string[];
  website: string | null;
  fintechId: string | null; // set if NeoBase tracks this provider
  sentiment: number | null; // our latest composite sentiment score, if tracked
}

/**
 * Full MiCA/ESMA CASP register (280 providers) joined to our tracked fintechs +
 * their latest sentiment score. Ordered by our sentiment (tracked/licensed
 * leaders first), then name — powers the searchable public registry page.
 */
export async function getMicaRegistry(): Promise<MicaRegistryRow[]> {
  const rows = await db.execute(sql`
    SELECT c.id, c.provider, c.legal_entity AS "legalEntity", c.country, c.regulator, c.services, c.website,
           f.id AS "fintechId", si.composite AS sentiment
    FROM casp_providers c
    LEFT JOIN fintechs f ON f.casp_provider_id = c.id
    LEFT JOIN LATERAL (
      SELECT composite FROM sentiment_index s WHERE s.fintech_id = f.id ORDER BY week DESC LIMIT 1
    ) si ON true
    ORDER BY si.composite DESC NULLS LAST, c.provider ASC
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    provider: r.provider,
    legalEntity: r.legalEntity ?? null,
    country: r.country,
    regulator: r.regulator,
    services: Array.isArray(r.services) ? r.services : [],
    website: r.website ?? null,
    fintechId: r.fintechId ?? null,
    sentiment: r.sentiment == null ? null : Number(r.sentiment),
  }));
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
