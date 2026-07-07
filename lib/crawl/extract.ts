/**
 * Turn a page's text into the canonical `Extracted` structure.
 *
 *  - live: Claude structured output (messages.parse + zod schema) — robust across
 *    heterogeneous marketing/pricing pages, normalising away layout differences.
 *  - mock: a deterministic generator keyed by (seed, snapshotDate) so the whole
 *    pipeline runs offline and, crucially, produces a *detectable* week-over-week
 *    change (a plan price drifts, a feature appears) without any network or key.
 *
 * `contentHash` hashes the canonicalised structure, so only real content moves
 * flip it — cosmetic HTML noise never does.
 */

import { createHash } from "node:crypto";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { anthropic, crawlModel, isClaudeLive } from "@/lib/anthropic";
import {
  ExtractedSchema,
  EMPTY_EXTRACTED,
  type CrawlKind,
  type Extracted,
} from "./types";

const MAX_INPUT_CHARS = 24_000; // keep extraction cheap; pricing/home fit easily

const SYSTEM = [
  "You extract a fintech company's public marketing/product page into a compact,",
  "canonical structure for week-over-week change tracking.",
  "Rules: capture PRICING PLANS (name + price string exactly as shown, e.g. '€9.99/mo',",
  "'Free', 'Custom'), product/benefit FEATURES (short noun phrases), promotional OFFERS",
  "(limited-time deals, sign-up bonuses), and any explicit FEE lines (label + value).",
  "Normalise wording lightly but do not invent items not present. Prefer fewer, higher-",
  "signal entries over exhaustive copy. Output only the structured fields.",
].join(" ");

const kindHint: Record<CrawlKind, string> = {
  homepage: "This is the company homepage — headline positioning, top features, any hero offer.",
  pricing_page: "This is a pricing page — enumerate every plan with its price, and per-plan highlights.",
  offer_page: "This is an offer/promo page — capture the offers and their terms.",
  blog: "This is a blog listing/post — capture post titles/topics under features; plans/fees usually empty.",
};

/** Extract page text into `Extracted` via Claude structured outputs. */
export async function extractLive(text: string, kind: CrawlKind, url: string): Promise<Extracted> {
  const clipped = text.slice(0, MAX_INPUT_CHARS);
  const res = await anthropic().messages.parse({
    model: crawlModel(),
    max_tokens: 2048,
    system: SYSTEM,
    output_config: {
      format: zodOutputFormat(ExtractedSchema),
      effort: "low", // cheap, deterministic-ish structured extraction
    },
    messages: [
      {
        role: "user",
        content: `${kindHint[kind]}\nURL: ${url}\n\nPAGE TEXT:\n${clipped}`,
      },
    ],
  });
  return res.parsed_output ?? { ...EMPTY_EXTRACTED, pageType: pageTypeFor(kind) };
}

function pageTypeFor(kind: CrawlKind): Extracted["pageType"] {
  return kind === "pricing_page" ? "pricing" : kind === "offer_page" ? "offer" : kind === "blog" ? "blog" : "homepage";
}

// ─── Deterministic mock (offline / no-key) ──────────────────────────────────

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FEATURE_POOL = [
  "Instant transfers",
  "Fee-free foreign spending",
  "Budgeting insights",
  "Virtual cards",
  "Savings vaults",
  "Crypto trading",
  "Salary advance",
  "Joint accounts",
];

/**
 * Deterministic Extracted keyed by (seed, snapshotDate). The date participates in
 * the seed so consecutive snapshots differ just enough to exercise diffing:
 * a plan price and the feature set drift week to week.
 */
export function mockExtract(seed: string, snapshotDate: string, kind: CrawlKind): Extracted {
  const rng = mulberry32(hashSeed(`${seed}`));
  const dated = mulberry32(hashSeed(`${seed}:${snapshotDate}`));

  const basePrice = 4 + Math.floor(rng() * 6); // stable per-source base
  const drift = Math.floor(dated() * 4); // date-dependent 0..3
  const plusPrice = (basePrice + drift).toFixed(2);

  const featureCount = 3 + Math.floor(dated() * 3); // 3..5, date-dependent
  const features = FEATURE_POOL.slice(0, featureCount);

  const hasOffer = dated() > 0.5;

  return {
    pageType: pageTypeFor(kind),
    headline: `Banking that works for you (${snapshotDate})`,
    plans: [
      { name: "Standard", price: "Free", priceNote: null },
      { name: "Plus", price: `€${plusPrice}/mo`, priceNote: "billed monthly" },
      { name: "Premium", price: `€${(basePrice + 8).toFixed(2)}/mo`, priceNote: null },
    ],
    features,
    offers: hasOffer ? ["3 months of Plus free for new customers"] : [],
    fees: [{ label: "ATM withdrawal over limit", value: "2%" }],
  };
}

// ─── Canonical hashing ──────────────────────────────────────────────────────

/** Stable JSON with sorted keys so equal content always hashes identically. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((value as any)[k])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function contentHash(e: Extracted): string {
  return createHash("sha256").update(canonical(e)).digest("hex");
}

/** Dispatch to the live or mock extractor based on key availability. */
export async function extract(
  opts: { text: string; kind: CrawlKind; url: string; seed: string; snapshotDate: string; mock?: boolean },
): Promise<Extracted> {
  const useMock = opts.mock ?? !isClaudeLive();
  return useMock
    ? mockExtract(opts.seed, opts.snapshotDate, opts.kind)
    : extractLive(opts.text, opts.kind, opts.url);
}
