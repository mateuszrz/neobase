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
import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";
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

  // NeoBase composite sentiment index — latest week + prior week for the WoW move.
  const si = await db.execute(sql`
    SELECT composite FROM sentiment_index WHERE fintech_id = ${fintechId} ORDER BY week DESC LIMIT 2
  `);
  const siRows = si.rows as any[];
  const composite = num(siRows[0]?.composite);
  const prevComposite = num(siRows[1]?.composite);
  const compositeDeltaWoW = composite != null && prevComposite != null ? Math.round((composite - prevComposite) * 10) / 10 : null;

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
    composite,
    compositeDeltaWoW,
    news: news.map((n) => ({ title: n.title, sentiment: n.sentiment ?? "neutral" })),
  };
}

const SYSTEM =
  "You write the 'Sentiment Overview' for a fintech on a competitive-intelligence directory: a sharp, " +
  "specific read of how the brand is perceived right now. Synthesise the supplied signals into an insight " +
  "rather than listing them — weave together the cross-platform review standing and its recent direction, " +
  "the NeoBase sentiment index (0–100) and its week-over-week move, and the tone and concrete themes of " +
  "recent headlines. Name specific drivers (a headline theme, a rating level, a shift) and flag any " +
  "divergence between customer and media sentiment. Neutral analyst voice: no hype, no advice, no invented " +
  "facts, every claim grounded in the supplied data. 2–3 sentences, 45–75 words. Do not repeat the brand " +
  "name more than once.";

/** Render the context as a readable signal block (beats a raw JSON dump). */
function briefData(ctx: BriefContext): string {
  const lines: string[] = [];
  if (ctx.avgRating != null)
    lines.push(`Review rating: ${ctx.avgRating.toFixed(1)}/5 across ${ctx.platformCount} platform(s) from ${new Intl.NumberFormat("en").format(ctx.ratingCount)} ratings.`);
  if (ctx.sentimentDir) lines.push(`Review-sentiment direction (recent weeks): ${ctx.sentimentDir}.`);
  if (ctx.composite != null)
    lines.push(`NeoBase sentiment index: ${ctx.composite.toFixed(0)}/100${ctx.compositeDeltaWoW != null ? ` (${ctx.compositeDeltaWoW >= 0 ? "+" : ""}${ctx.compositeDeltaWoW.toFixed(1)} vs last week)` : ""}.`);
  if (ctx.news.length) {
    lines.push("Recent headlines (sentiment toward the brand in brackets):");
    for (const n of ctx.news) lines.push(`  - [${n.sentiment}] ${n.title}`);
  }
  return lines.length ? lines.join("\n") : "No public signals available yet.";
}

async function writeWithClaude(name: string, ctx: BriefContext): Promise<string> {
  // Haiku by default; no `effort` (it 400s on Haiku); short hard timeout + no
  // retries so one slow call can't stall a batch run of the weekly-briefs cron.
  const res = await anthropic().messages.create(
    {
      model: env.ANTHROPIC_BRIEF_MODEL,
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: `Fintech: ${name}\n\n${briefData(ctx)}` }],
    },
    { timeout: 20_000, maxRetries: 0 },
  );
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  return text || composeBrief(name, ctx);
}

/** Generate + upsert the weekly brief for one fintech. Returns the text. */
export async function generateSummary(fintechId: string): Promise<string> {
  const [ft] = await db.select({ name: fintechs.name }).from(fintechs).where(eq(fintechs.id, fintechId)).limit(1);
  if (!ft) throw new Error(`no such fintech: ${fintechId}`);

  const ctx = await gatherContext(fintechId);
  let summary: string;
  let model: string;
  if (isClaudeLive()) {
    try {
      summary = await writeWithClaude(ft.name, ctx);
      model = env.ANTHROPIC_BRIEF_MODEL;
    } catch {
      summary = composeBrief(ft.name, ctx); // API/timeout failure → grounded fallback
      model = "composed";
    }
  } else {
    summary = composeBrief(ft.name, ctx);
    model = "composed";
  }

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
