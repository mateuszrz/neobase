/**
 * Shared contracts for the crawl + diff engine.
 *
 * `Extracted` is the canonical, source-agnostic structure Claude distils from a
 * page's text (or the mock produces deterministically). Hashing this — not the
 * raw HTML — is what makes change detection meaningful: cosmetic markup noise
 * (tokens, timestamps, reordered nodes) never flips the hash, only real changes
 * to plans/prices/features/offers do.
 */

import { z } from "zod";

/** Page kinds the crawl engine understands (drives extraction hints). */
export type CrawlKind = "homepage" | "pricing_page" | "offer_page" | "blog";

export const CRAWL_KINDS: CrawlKind[] = ["homepage", "pricing_page", "offer_page", "blog"];

export function isCrawlKind(k: string): k is CrawlKind {
  return (CRAWL_KINDS as string[]).includes(k);
}

// ─── Extraction schema (structured output) ──────────────────────────────────
// Kept flat and constraint-free (no min/max/format) so it maps cleanly onto
// Claude structured outputs. Prices stay strings to carry currency + cadence
// ("€9.99/mo", "Free", "Custom") without lossy parsing.

export const PlanSchema = z.object({
  name: z.string(),
  price: z.string(),
  priceNote: z.string().nullable(),
});

export const FeeSchema = z.object({
  label: z.string(),
  value: z.string(),
});

export const ExtractedSchema = z.object({
  pageType: z.enum(["homepage", "pricing", "offer", "blog", "other"]),
  headline: z.string().nullable(),
  plans: z.array(PlanSchema),
  features: z.array(z.string()),
  offers: z.array(z.string()),
  fees: z.array(FeeSchema),
});

export type Plan = z.infer<typeof PlanSchema>;
export type Fee = z.infer<typeof FeeSchema>;
export type Extracted = z.infer<typeof ExtractedSchema>;

export const EMPTY_EXTRACTED: Extracted = {
  pageType: "other",
  headline: null,
  plans: [],
  features: [],
  offers: [],
  fees: [],
};

// ─── Diff contracts ─────────────────────────────────────────────────────────

export type ChangeKind = "price" | "feature" | "offer" | "copy";

/** Structural delta between two Extracted snapshots. */
export interface ExtractedDiff {
  added: { plans: Plan[]; features: string[]; offers: string[]; fees: Fee[] };
  removed: { plans: Plan[]; features: string[]; offers: string[]; fees: Fee[] };
  /** Same plan name, changed price/note. */
  changed: { plan: string; from: string; to: string }[];
  headline: { from: string | null; to: string | null } | null;
}

/** Everything needed to write one content_changes row. */
export interface ChangeSummary {
  changeKinds: ChangeKind[];
  summary: string;
}

/** True when the diff carries no meaningful change. */
export function diffIsEmpty(d: ExtractedDiff): boolean {
  return (
    d.added.plans.length === 0 &&
    d.added.features.length === 0 &&
    d.added.offers.length === 0 &&
    d.added.fees.length === 0 &&
    d.removed.plans.length === 0 &&
    d.removed.features.length === 0 &&
    d.removed.offers.length === 0 &&
    d.removed.fees.length === 0 &&
    d.changed.length === 0 &&
    d.headline === null
  );
}
