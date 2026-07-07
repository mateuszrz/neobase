/**
 * Weekly AI brief generation.
 *
 * Gathers a fintech's current ratings, sentiment direction and recent news, then
 * writes a short brief — via Claude when ANTHROPIC_API_KEY is set, otherwise via
 * the deterministic composer (still grounded in real data). Upserts one row per
 * (fintech, kind) so the weekly job just refreshes it.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, crawlModel, isClaudeLive } from "@/lib/anthropic";
import { composeBrief, type BriefContext, type SentimentDir } from "./compose";

const { aiSummaries, metricSnapshots, newsItems, fintechs } = schema;

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Build the brief context for a fintech from live snapshots + stored news. */
export async function gatherContext(fintechId: string): Promise<BriefContext> {
  // Latest rating per platform (ZZ, recent) → avg + totals.
  const rt = await db.execute(sql`
    SELECT DISTINCT ON (kind) kind, rating, review_count AS count, sentiment_pos AS pos
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ'
      AND kind IN ('trustpilot','google_play','app_store') AND rating IS NOT NULL
      AND snapshot_date >= current_date - interval '21 days'
    ORDER BY kind, snapshot_date DESC
  `);
  const rows = rt.rows as any[];
  const ratings = rows.map((r) => num(r.rating)).filter((v): v is number => v != null);
  const avgRating = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : null;
  const ratingCount = rows.reduce((s, r) => s + (num(r.count) ?? 0), 0);

  // Sentiment direction: recent vs older average positive-sentiment (ZZ).
  const sd = await db.execute(sql`
    SELECT
      avg(sentiment_pos) FILTER (WHERE snapshot_date >= current_date - interval '7 days')  AS recent,
      avg(sentiment_pos) FILTER (WHERE snapshot_date <  current_date - interval '7 days')  AS older
    FROM metric_snapshots
    WHERE fintech_id = ${fintechId} AND country = 'ZZ' AND raw IS NOT NULL AND sentiment_pos IS NOT NULL
      AND snapshot_date >= current_date - interval '35 days'
  `);
  const srow = (sd.rows as any[])[0] ?? {};
  const recent = num(srow.recent);
  const older = num(srow.older);
  let sentimentDir: SentimentDir | null = null;
  if (recent != null && older != null) {
    const d = recent - older;
    sentimentDir = d > 1.5 ? "improving" : d < -1.5 ? "softening" : "steady";
  }

  // Recent news (real rows only).
  const news = await db
    .select({ title: newsItems.title, sentiment: newsItems.sentiment })
    .from(newsItems)
    .where(eq(newsItems.fintechId, fintechId))
    .orderBy(desc(newsItems.publishedAt))
    .limit(5);

  return {
    avgRating,
    ratingCount,
    platformCount: rows.length,
    sentimentDir,
    news: news.map((n) => ({ title: n.title, sentiment: n.sentiment ?? "neutral" })),
  };
}

const SYSTEM =
  "You write a neutral, factual 2–3 sentence weekly brief on a fintech for a competitive-intelligence " +
  "directory. Ground every claim in the supplied data (ratings, sentiment direction, recent headlines). " +
  "No hype, no advice, no invented facts. Plain prose, under 60 words.";

async function writeWithClaude(name: string, ctx: BriefContext): Promise<string> {
  const res = await anthropic().messages.create({
    model: crawlModel(),
    max_tokens: 300,
    system: SYSTEM,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: `Fintech: ${name}\nData:\n${JSON.stringify(ctx, null, 2)}` }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text || composeBrief(name, ctx);
}

/** Generate + upsert the weekly brief for one fintech. Returns the text. */
export async function generateSummary(fintechId: string): Promise<string> {
  const [ft] = await db.select({ name: fintechs.name }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!ft) throw new Error(`no such fintech: ${fintechId}`);

  const ctx = await gatherContext(fintechId);
  const live = isClaudeLive();
  const summary = live ? await writeWithClaude(ft.name, ctx) : composeBrief(ft.name, ctx);
  const model = live ? crawlModel() : "composed";

  await db
    .insert(aiSummaries)
    .values({ fintechId, kind: "weekly_brief", summary, generatedFor: new Date().toISOString().slice(0, 10), model })
    .onConflictDoUpdate({
      target: [aiSummaries.fintechId, aiSummaries.kind],
      set: { summary, generatedFor: new Date().toISOString().slice(0, 10), model, updatedAt: new Date() },
    });
  return summary;
}

/** Fetch the stored weekly brief (or null). */
export async function getStoredSummary(
  fintechId: string,
): Promise<{ text: string; updatedAt: Date; model: string | null } | null> {
  const [row] = await db
    .select({ summary: aiSummaries.summary, updatedAt: aiSummaries.updatedAt, model: aiSummaries.model })
    .from(aiSummaries)
    .where(and(eq(aiSummaries.fintechId, fintechId), eq(aiSummaries.kind, "weekly_brief")))
    .limit(1);
  return row ? { text: row.summary, updatedAt: row.updatedAt, model: row.model } : null;
}
