/**
 * "Test our reports" generator.
 *
 * Resolves the brand + competitor inputs to tracked fintechs, gathers the real
 * data we hold for each (cross-platform rating, sentiment direction, recent news
 * and social — never sample/fabricated rows), then produces the structured
 * weekly report via Claude when ANTHROPIC_API_KEY is set, else via a
 * deterministic composer. Persists one report_requests row (the captured lead)
 * and returns its id.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, crawlModel, isClaudeLive } from "@/lib/anthropic";
import { gatherContext } from "@/lib/summary/generate";
import { sampleNews } from "@/lib/news/sample";
import { sampleSocialPosts } from "@/lib/social/sample";
import { matchFintechs, type Candidate } from "./match";
import { REPORT_SYSTEM, buildUserMessage } from "./prompt";
import type { BrandData, Report, ReportBrandFocus, Severity } from "./types";

const { reportRequests, socialPosts } = schema;

/** Real (ingested) social posts for a fintech — empty until Apify is live. */
async function realSocial(fintechId: string): Promise<{ network: string; text: string }[]> {
  const rows = await db
    .select({ network: socialPosts.network, text: socialPosts.text, postedAt: socialPosts.postedAt })
    .from(socialPosts)
    .where(and(eq(socialPosts.fintechId, fintechId), gte(socialPosts.postedAt, sql`current_date - interval '30 days'`)))
    .orderBy(desc(socialPosts.postedAt))
    .limit(4);
  return rows.filter((r) => r.text).map((r) => ({ network: r.network, text: r.text as string }));
}

/** Build the data context for one matched/unmatched candidate. Ratings and
 * sentiment are always real; news/social fall back to the same deterministic
 * SAMPLE we show on public profiles when no live items exist yet, so the demo
 * report is populated (and swaps to real data automatically once live). */
async function brandData(c: Candidate, isBrand: boolean): Promise<BrandData> {
  if (!c.fintechId) {
    const news = sampleNews(c.name, c.name, 3).map((n) => ({ title: n.title, sentiment: n.sentiment }));
    const social = sampleSocialPosts(c.name, c.name, 2).map((p) => ({ network: p.network, text: p.text }));
    return { name: c.name, isBrand, tracked: false, avgRating: null, ratingCount: 0, platformCount: 0, sentimentDir: null, news, social, sampleMedia: true };
  }
  const [ctx, liveSocial] = await Promise.all([gatherContext(c.fintechId), realSocial(c.fintechId)]);

  let news = ctx.news;
  let social = liveSocial;
  let sampleMedia = false;
  if (!news.length) {
    news = sampleNews(c.fintechId, c.name, 3).map((n) => ({ title: n.title, sentiment: n.sentiment }));
    sampleMedia = true;
  }
  if (!social.length) {
    social = sampleSocialPosts(c.fintechId, c.name, 2).map((p) => ({ network: p.network, text: p.text }));
    sampleMedia = true;
  }

  return {
    name: c.name,
    isBrand,
    tracked: true,
    avgRating: ctx.avgRating,
    ratingCount: ctx.ratingCount,
    platformCount: ctx.platformCount,
    sentimentDir: ctx.sentimentDir,
    news,
    social,
    sampleMedia,
  };
}

function dataNoteFor(brandTracked: boolean, usesSampleMedia: boolean): string | null {
  if (!brandTracked)
    return "This brand isn't in our tracked set yet, so the brief below uses illustrative demo data. Once we onboard it, the report is built from its live ratings, sentiment and media coverage.";
  if (usesSampleMedia)
    return "Ratings and customer sentiment here are live. The news & social items are illustrative demo samples (the same you'd see on our public profiles) — they switch to live media tracking on a paid project.";
  return null;
}

// ─── Claude path ─────────────────────────────────────────────────────────────

function extractJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in model output");
  return JSON.parse(body.slice(start, end + 1));
}

async function writeWithClaude(brand: string, brands: BrandData[]): Promise<Partial<Report>> {
  const res = await anthropic().messages.create({
    model: crawlModel(),
    max_tokens: 2500,
    system: REPORT_SYSTEM,
    output_config: { effort: "low" },
    messages: [{ role: "user", content: buildUserMessage(brand, brands) }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return extractJson(text);
}

// ─── Deterministic composer (no-key fallback, still grounded) ─────────────────

const DIR_PHRASE: Record<string, string> = {
  improving: "customer sentiment has been improving",
  steady: "customer sentiment has held steady",
  softening: "customer sentiment has softened recently",
};

function composeBrandFocus(b: BrandData): ReportBrandFocus {
  const themes: string[] = [];
  if (b.avgRating != null) themes.push(`Cross-platform rating of ${b.avgRating.toFixed(1)}/5 across ${b.platformCount} platform${b.platformCount === 1 ? "" : "s"}.`);
  if (b.sentimentDir) themes.push(`${cap(DIR_PHRASE[b.sentimentDir])}.`);
  for (const n of b.news.slice(0, 2)) themes.push(n.title);
  return {
    rating: b.avgRating,
    ratingCount: b.ratingCount,
    sentimentDir: b.sentimentDir,
    themes: themes.length ? themes : ["Building its public rating profile."],
    risks: b.sentimentDir === "softening" ? ["Sentiment is softening — watch review drivers before it shows up in ratings."] : [],
    opportunities: b.avgRating != null && b.avgRating >= 4 ? ["Strong ratings are an underused proof point for acquisition messaging."] : [],
    actions: ["Track week-over-week rating and sentiment moves against the competitor set."],
  };
}

function composeReport(brand: string, brands: BrandData[]): Partial<Report> {
  const self = brands.find((b) => b.isBrand) ?? brands[0];
  const comps = brands.filter((b) => !b.isBrand);
  const exec: string[] = [];
  if (self?.avgRating != null) exec.push(`${self.name} holds a ${self.avgRating.toFixed(1)}/5 cross-platform rating from ${new Intl.NumberFormat("en").format(self.ratingCount)} ratings.`);
  if (self?.sentimentDir) exec.push(`For ${self.name}, ${DIR_PHRASE[self.sentimentDir]}.`);
  const rated = comps.filter((c) => c.avgRating != null).sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
  if (rated.length) exec.push(`Best-rated competitor this week: ${rated[0].name} (${rated[0].avgRating!.toFixed(1)}/5).`);
  for (const b of brands) for (const n of b.news.slice(0, 1)) exec.push(`${b.name}: ${n.title}`);

  return {
    execSummary: exec.slice(0, 8),
    brandFocus: self ? composeBrandFocus(self) : composeBrandFocus(brands[0]),
    competitorMoves: comps.map((c) => ({
      name: c.name,
      whatHappened: c.news[0]?.title ?? (c.avgRating != null ? `Holding a ${c.avgRating.toFixed(1)}/5 rating; no major public events this week.` : "No public events detected this week."),
      whyItMatters: c.avgRating != null ? `Rated ${c.avgRating.toFixed(1)}/5 — a direct benchmark for ${brand}.` : "Limited data on file.",
      impact: c.sentimentDir === "improving" ? `Momentum worth watching against ${brand}.` : "Neutral this week.",
      severity: (c.sentimentDir === "improving" ? "medium" : "low") as Severity,
      needsReaction: false,
    })),
    products: [],
    marketing: brands.flatMap((b) => b.social.slice(0, 1).map((s) => `${b.name} (${s.network}): ${s.text.slice(0, 140)}`)),
    signals: [],
    risks: self?.sentimentDir === "softening" ? [{ text: `${self.name}'s customer sentiment is softening.`, severity: "medium" as Severity }] : [],
    recommendations: {
      now: ["Set a weekly rating + sentiment baseline for the brand and each competitor."],
      watch: rated.slice(0, 2).map((c) => `${c.name}'s rating trajectory.`),
      productInspiration: [],
      marketingInspiration: [],
    },
  };
}

// ─── Assemble + persist ──────────────────────────────────────────────────────

const EMPTY_FOCUS: ReportBrandFocus = { rating: null, ratingCount: 0, sentimentDir: null, themes: [], risks: [], opportunities: [], actions: [] };

/** Fill any gaps a partial (from Claude or composer) leaves, and stamp metadata. */
function assemble(brand: string, brands: BrandData[], grounded: boolean, partial: Partial<Report>): Report {
  const self = brands.find((b) => b.isBrand);
  const focus = partial.brandFocus ?? EMPTY_FOCUS;
  const usesSampleMedia = brands.some((b) => b.sampleMedia);
  return {
    brand,
    competitors: brands.filter((b) => !b.isBrand).map((b) => b.name),
    grounded,
    usesSampleMedia,
    dataNote: dataNoteFor(grounded, usesSampleMedia),
    generatedAt: new Date().toISOString().slice(0, 10),
    periodDays: 7,
    execSummary: partial.execSummary ?? [],
    brandFocus: { ...focus, rating: self?.avgRating ?? focus.rating, ratingCount: self?.ratingCount ?? focus.ratingCount, sentimentDir: self?.sentimentDir ?? focus.sentimentDir },
    competitorMoves: partial.competitorMoves ?? [],
    products: partial.products ?? [],
    marketing: partial.marketing ?? [],
    signals: partial.signals ?? [],
    risks: partial.risks ?? [],
    recommendations: partial.recommendations ?? { now: [], watch: [], productInspiration: [], marketingInspiration: [] },
  };
}

export interface GenerateResult {
  id: string;
  report: Report;
}

/**
 * Generate + persist a report for a brand and its competitors. Returns the row
 * id (the shareable teaser URL is /test/<id>).
 */
export async function generateReport(brandInput: string, competitorInputs: string[], ip?: string | null): Promise<GenerateResult> {
  const [brandC] = await matchFintechs([brandInput]);
  const compCs = (await matchFintechs(competitorInputs)).filter((c) => !brandC || c.fintechId !== brandC.fintechId);

  const brandName = brandC?.name ?? brandInput.trim();
  const grounded = Boolean(brandC?.fintechId);

  const brands: BrandData[] = await Promise.all([
    brandData(brandC ?? { input: brandInput, fintechId: null, name: brandName }, true),
    ...compCs.map((c) => brandData(c, false)),
  ]);

  let partial: Partial<Report>;
  let model: string;
  if (isClaudeLive()) {
    try {
      partial = await writeWithClaude(brandName, brands);
      model = crawlModel();
    } catch {
      partial = composeReport(brandName, brands); // network/parse failure → grounded fallback
      model = "composed";
    }
  } else {
    partial = composeReport(brandName, brands);
    model = "composed";
  }

  const report = assemble(brandName, brands, grounded, partial);

  const matchedIds = [brandC?.fintechId, ...compCs.map((c) => c.fintechId)].filter((x): x is string => Boolean(x));

  const [row] = await db
    .insert(reportRequests)
    .values({
      brand: brandInput.trim(),
      competitors: competitorInputs.map((s) => s.trim()).filter(Boolean),
      brandFintechId: brandC?.fintechId ?? null,
      matchedIds,
      report: report as unknown as Record<string, unknown>,
      model,
      ip: ip ?? null,
    })
    .returning({ id: reportRequests.id });

  return { id: row.id, report };
}

/** Fetch a stored report request (for the teaser page). */
export async function getReportRequest(id: string): Promise<{ report: Report; unlocked: boolean } | null> {
  const [row] = await db
    .select({ report: reportRequests.report, unlockedAt: reportRequests.unlockedAt })
    .from(reportRequests)
    .where(eq(reportRequests.id, id))
    .limit(1);
  if (!row) return null;
  return { report: row.report as unknown as Report, unlocked: row.unlockedAt != null };
}

/** Capture the lead's email and unlock the full report. Returns the brand (for
 * the confirmation email), or null if the id doesn't exist. */
export async function unlockReport(id: string, email: string): Promise<{ brand: string } | null> {
  const [row] = await db
    .update(reportRequests)
    .set({ email: email.trim().toLowerCase(), unlockedAt: new Date() })
    .where(eq(reportRequests.id, id))
    .returning({ report: reportRequests.report });
  if (!row) return null;
  return { brand: (row.report as unknown as Report).brand };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
