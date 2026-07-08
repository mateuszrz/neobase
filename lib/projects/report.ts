/**
 * Monthly per-project intelligence report.
 *
 * Gathers the project's brands × markets movement over a window (Trustpilot
 * rating start→end, sentiment, volume) + recent content changes, then writes a
 * short narrative via Claude (Haiku) when ANTHROPIC_API_KEY is set, else a
 * deterministic composer. Upserts one row per (project, period-end). Grounded
 * only in collected data — never invents.
 */

import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";

const { projects, projectBrands, projectMarkets, projectReports, fintechs, contentChanges } = schema;

export interface Movement {
  brand: string;
  market: string;
  ratingNow: number | null;
  ratingPrev: number | null;
  delta: number | null;
  pos: number | null;
  count: number | null;
}
export interface ProjectReportDoc {
  periodDays: number;
  generatedAt: string;
  brands: string[];
  markets: string[];
  execSummary: string[];
  brandHighlights: { brand: string; text: string }[];
  recommendations: string[];
  dataNote: string | null;
}

interface ReportContext {
  projectName: string;
  brands: string[];
  markets: string[];
  movements: Movement[];
  changes: { brand: string; market: string; kinds: string[]; summary: string | null }[];
}

function n(v: unknown): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? x : null;
}

async function gatherContext(projectId: string, days: number): Promise<ReportContext> {
  const [proj] = await db.select({ name: projects.name }).from(projects).where(eq(projects.id, projectId)).limit(1);
  const [brandRows, marketRows] = await Promise.all([
    db.select({ id: projectBrands.fintechId, name: fintechs.name }).from(projectBrands).innerJoin(fintechs, eq(fintechs.id, projectBrands.fintechId)).where(eq(projectBrands.projectId, projectId)),
    db.select({ country: projectMarkets.country }).from(projectMarkets).where(eq(projectMarkets.projectId, projectId)),
  ]);
  const nameById = new Map(brandRows.map((b) => [b.id, b.name]));
  const brandIds = brandRows.map((b) => b.id);
  const markets = marketRows.map((m) => m.country);
  if (!brandIds.length || !markets.length) {
    return { projectName: proj?.name ?? "Project", brands: brandRows.map((b) => b.name), markets, movements: [], changes: [] };
  }

  // Rating at start vs end of the window, per (brand, market).
  const rows = await db.execute(sql`
    WITH w AS (
      SELECT fintech_id, country, snapshot_date, rating, review_count, sentiment_pos
      FROM metric_snapshots
      WHERE kind = 'trustpilot' AND fintech_id IN ${brandIds} AND country IN ${markets}
        AND snapshot_date >= current_date - (${days} * interval '1 day')
    )
    SELECT fintech_id AS "fintechId", country,
           (array_agg(rating ORDER BY snapshot_date DESC))[1]        AS rating_now,
           (array_agg(rating ORDER BY snapshot_date ASC))[1]         AS rating_prev,
           (array_agg(sentiment_pos ORDER BY snapshot_date DESC))[1] AS pos,
           (array_agg(review_count ORDER BY snapshot_date DESC))[1]  AS count
    FROM w GROUP BY fintech_id, country
  `);
  const movements: Movement[] = (rows.rows as any[]).map((r) => {
    const now = n(r.rating_now);
    const prev = n(r.rating_prev);
    return {
      brand: nameById.get(r.fintechId) ?? r.fintechId,
      market: r.country,
      ratingNow: now,
      ratingPrev: prev,
      delta: now != null && prev != null ? Math.round((now - prev) * 100) / 100 : null,
      pos: n(r.pos),
      count: n(r.count),
    };
  });

  const chg = await db
    .select({ fintechId: contentChanges.fintechId, country: contentChanges.country, changeKinds: contentChanges.changeKinds, summary: contentChanges.summary })
    .from(contentChanges)
    .where(sql`${contentChanges.fintechId} IN ${brandIds} AND ${contentChanges.toDate} >= current_date - (${days} * interval '1 day')`)
    .orderBy(desc(contentChanges.toDate))
    .limit(12);
  const changes = chg.map((c) => ({ brand: nameById.get(c.fintechId) ?? c.fintechId, market: c.country, kinds: c.changeKinds ?? [], summary: c.summary }));

  return { projectName: proj?.name ?? "Project", brands: brandRows.map((b) => b.name), markets, movements, changes };
}

// ─── Claude ──────────────────────────────────────────────────────────────────

const SYSTEM =
  "You write a concise monthly competitive-intelligence brief for a fintech team, over the brands and markets THEY track. " +
  "Ground every statement in the supplied movement data (rating changes, sentiment, volume, competitor page changes) — never invent. " +
  "If the data is thin, say so briefly. Business tone, no hype.";

const CONTRACT =
  'Respond with ONLY a JSON object: {"execSummary": string[] (3-6 key takeaways), ' +
  '"brandHighlights": [{"brand": string, "text": string}] (one per tracked brand with any signal), ' +
  '"recommendations": string[] (2-4 concrete actions)}. Keep it tight.';

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const a = body.indexOf("{");
  const b = body.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error("no JSON");
  return JSON.parse(body.slice(a, b + 1));
}

async function writeWithClaude(ctx: ReportContext): Promise<Partial<ProjectReportDoc>> {
  const res = await anthropic().messages.create(
    {
      model: env.ANTHROPIC_REPORT_MODEL,
      max_tokens: 1800,
      system: SYSTEM,
      messages: [{ role: "user", content: `Project: ${ctx.projectName}\nData:\n${JSON.stringify({ movements: ctx.movements, changes: ctx.changes }, null, 2)}\n\n${CONTRACT}` }],
    },
    { timeout: 30_000, maxRetries: 0 },
  );
  const text = res.content.map((c) => (c.type === "text" ? c.text : "")).join("");
  return extractJson(text);
}

// ─── Deterministic composer (grounded fallback) ──────────────────────────────

function compose(ctx: ReportContext): Partial<ProjectReportDoc> {
  const rated = ctx.movements.filter((m) => m.ratingNow != null);
  const moved = rated.filter((m) => m.delta != null && Math.abs(m.delta) >= 0.05).sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!));
  const exec: string[] = [];
  if (!rated.length) exec.push("No rating data collected for the tracked brands/markets yet — signals appear as the daily collection runs.");
  else exec.push(`Tracking ${ctx.brands.length} brand${ctx.brands.length === 1 ? "" : "s"} across ${ctx.markets.length} market${ctx.markets.length === 1 ? "" : "s"} — ${rated.length} live rating signal(s) this period.`);
  for (const m of moved.slice(0, 3)) exec.push(`${m.brand} (${m.market}): rating ${m.delta! > 0 ? "up" : "down"} ${Math.abs(m.delta!).toFixed(2)} to ${m.ratingNow!.toFixed(2)}.`);
  if (ctx.changes.length) exec.push(`${ctx.changes.length} competitor page change(s) detected (${[...new Set(ctx.changes.flatMap((c) => c.kinds))].join(", ") || "content"}).`);

  const brandHighlights = ctx.brands.map((brand) => {
    const ms = ctx.movements.filter((m) => m.brand === brand && m.ratingNow != null);
    if (!ms.length) return { brand, text: "No live signals collected yet." };
    const parts = ms.map((m) => `${m.market}: ${m.ratingNow!.toFixed(2)}★${m.delta ? ` (${m.delta > 0 ? "+" : ""}${m.delta.toFixed(2)})` : ""}${m.pos != null ? `, ${m.pos.toFixed(0)}% positive` : ""}`);
    return { brand, text: parts.join(" · ") };
  });

  return {
    execSummary: exec.slice(0, 6),
    brandHighlights,
    recommendations: moved.length
      ? [`Investigate the driver behind ${moved[0].brand}'s ${moved[0].delta! > 0 ? "gain" : "drop"} in ${moved[0].market}.`, "Set a weekly baseline and watch the biggest movers."]
      : ["Add more markets/brands or wait for the daily collection to build a trend."],
  };
}

// ─── Assemble + persist ──────────────────────────────────────────────────────

function assemble(ctx: ReportContext, days: number, partial: Partial<ProjectReportDoc>): ProjectReportDoc {
  const grounded = ctx.movements.some((m) => m.ratingNow != null) || ctx.changes.length > 0;
  return {
    periodDays: days,
    generatedAt: new Date().toISOString().slice(0, 10),
    brands: ctx.brands,
    markets: ctx.markets,
    execSummary: partial.execSummary ?? [],
    brandHighlights: partial.brandHighlights ?? [],
    recommendations: partial.recommendations ?? [],
    dataNote: grounded ? null : "Limited collected data so far — this brief fills out as the daily-project collection runs.",
  };
}

/** Generate + upsert the report for a project. Returns the doc. */
export async function generateProjectReport(projectId: string, days = 30): Promise<ProjectReportDoc> {
  const ctx = await gatherContext(projectId, days);

  let partial: Partial<ProjectReportDoc>;
  let model: string;
  if (isClaudeLive()) {
    try {
      partial = await writeWithClaude(ctx);
      model = env.ANTHROPIC_REPORT_MODEL;
    } catch {
      partial = compose(ctx);
      model = "composed";
    }
  } else {
    partial = compose(ctx);
    model = "composed";
  }

  const doc = assemble(ctx, days, partial);
  const generatedFor = new Date().toISOString().slice(0, 10);
  await db
    .insert(projectReports)
    .values({ projectId, periodDays: days, generatedFor, report: doc as unknown as Record<string, unknown>, model })
    .onConflictDoUpdate({ target: [projectReports.projectId, projectReports.generatedFor], set: { report: doc as unknown as Record<string, unknown>, model, periodDays: days, updatedAt: new Date() } });
  return doc;
}

/** Latest stored report for a project (or null). */
export async function getProjectReport(projectId: string): Promise<{ report: ProjectReportDoc; updatedAt: Date; model: string | null } | null> {
  const [row] = await db
    .select({ report: projectReports.report, updatedAt: projectReports.updatedAt, model: projectReports.model })
    .from(projectReports)
    .where(eq(projectReports.projectId, projectId))
    .orderBy(desc(projectReports.generatedFor))
    .limit(1);
  return row ? { report: row.report as unknown as ProjectReportDoc, updatedAt: row.updatedAt, model: row.model } : null;
}
