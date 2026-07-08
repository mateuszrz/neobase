/**
 * Structured weekly competitive-intelligence report — the shape the "test our
 * reports" generator produces and the teaser page renders. Mirrors the eight
 * sections of the source prompt (see lib/report/prompt.ts), but every field is
 * grounded in data we actually hold (ratings, sentiment, real news/social) — the
 * generator instructs the model never to invent events.
 */

export type Severity = "high" | "medium" | "low";

/** One competitor's most important development this week (section 3). */
export interface ReportCompetitor {
  name: string;
  whatHappened: string;
  whyItMatters: string;
  impact: string; // implication for the brand
  severity: Severity;
  needsReaction: boolean;
}

/** A product / partnership row (section 4). */
export interface ReportProductRow {
  company: string;
  item: string; // product or partnership
  description: string;
  significance: string; // strategic significance
  reaction: string; // possible reaction by the brand
}

/** Recommendations, split by horizon (section 8). */
export interface ReportRecommendations {
  now: string[];
  watch: string[];
  productInspiration: string[];
  marketingInspiration: string[];
}

/** The brand's own focus block (section 2). */
export interface ReportBrandFocus {
  rating: number | null; // cross-platform avg, 1–5
  ratingCount: number;
  sentimentDir: "improving" | "steady" | "softening" | null;
  themes: string[];
  risks: string[];
  opportunities: string[];
  actions: string[];
}

export interface Report {
  brand: string; // display name
  competitors: string[]; // display names (matched or raw)
  grounded: boolean; // true when the brand matched a tracked fintech
  dataNote: string | null; // honest caveat about coverage (e.g. no live news yet)
  generatedAt: string; // ISO date
  periodDays: number; // analysis window (7)
  execSummary: string[]; // section 1 — 5–8 findings (free)
  brandFocus: ReportBrandFocus; // section 2 (free)
  competitorMoves: ReportCompetitor[]; // section 3 (gated)
  products: ReportProductRow[]; // section 4 (gated)
  marketing: string[]; // section 5 (gated)
  signals: string[]; // section 6 — weak strategic signals (gated)
  risks: { text: string; severity: Severity }[]; // section 7 (gated)
  recommendations: ReportRecommendations; // section 8 (gated)
}

/** Per-brand data context handed to the generator (real data only). */
export interface BrandData {
  name: string;
  isBrand: boolean; // the client brand vs a competitor
  tracked: boolean; // matched a fintech we hold data for
  avgRating: number | null;
  ratingCount: number;
  platformCount: number;
  sentimentDir: "improving" | "steady" | "softening" | null;
  news: { title: string; sentiment: string }[]; // real news_items only
  social: { network: string; text: string }[]; // real social_posts only
}
