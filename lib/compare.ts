/**
 * Data layer for the "X vs Y" comparison pages.
 *
 * Fetches two same-type fintechs and the signals NeoBase tracks for each, then
 * decides a per-metric winner. Everything respects the same trust gates the
 * profile does: a fact whose `fact_confidence` is not "high" (or a brand in
 * HIDE_COMPANY_FACTS) is never surfaced here either, so the comparison can't
 * reveal something the profile itself would hide.
 */

import { getFintech, getPlatformRatings, getMicaStatus, getTopNeobanks, getTopExchanges, type MicaStatus, type FintechListItem } from "@/lib/queries";
import { getSentimentIndex } from "@/lib/sentiment";
import { HIDE_COMPANY_FACTS } from "@/lib/trust";

export type Kind = "neobank" | "exchange";
export type Winner = "a" | "b" | "tie" | null;
type PlatformKey = "trustpilot" | "google_play" | "app_store";
const PLATFORMS: PlatformKey[] = ["trustpilot", "google_play", "app_store"];

export interface CompareSide {
  id: string;
  name: string;
  country: string | null; // gated
  logoSvg: string | null;
  website: string | null;
  founded: number | null; // gated
  headquarters: string | null; // gated
  status: string | null; // gated
  ownership: string | null; // gated
  tags: string[];
  showCompanyFacts: boolean;
  sentiment: number | null;
  sentimentDelta: number | null;
  ratings: Record<PlatformKey, { rating: number | null; count: number | null; pos: number | null }>;
  reviewVolume: number;
  mica: MicaStatus;
}

export interface CompareMetric {
  key: string;
  section: "sentiment" | "ratings" | "company" | "mica";
  a: number | string | boolean | null;
  b: number | string | boolean | null;
  win: Winner;
  kind: "score" | "rating" | "count" | "year" | "text" | "bool" | "services";
}

export interface WinnerBox {
  key: "sentiment" | "ratings" | "app" | "regulation" | "reviews";
  win: "a" | "b" | "tie";
}

export interface Comparison {
  type: Kind;
  a: CompareSide;
  b: CompareSide;
  metrics: CompareMetric[];
  winnerBoxes: WinnerBox[];
  aWins: number;
  bWins: number;
}

/** Parse an "a-vs-b" pair slug. Slugs can contain hyphens/underscores; only the
 *  literal "-vs-" separator is split on. */
export function parsePair(pair: string): [string, string] | null {
  const i = pair.indexOf("-vs-");
  if (i <= 0) return null;
  const a = pair.slice(0, i);
  const b = pair.slice(i + 4);
  if (!a || !b || a === b) return null;
  return [a, b];
}

/** Canonical pair slug (alphabetical, so a-vs-b and b-vs-a share one URL). */
export function pairSlug(a: string, b: string): string {
  return a < b ? `${a}-vs-${b}` : `${b}-vs-${a}`;
}

/**
 * A bounded, curated set of pairs to prerender and list in the sitemap: all
 * intra-type pairs among the top few brands of each type. The full X×Y space is
 * O(n²) (thousands of pages) — we let the long tail render on-demand (ISR) and
 * only commit this curated head to the build, to keep prerender counts sane on
 * a build that already prerenders ~1100 pages.
 */
/** A few popular same-type peers to offer as "compare with" suggestions on a
 *  profile, excluding the profile itself. Ranked by our sentiment/rating. */
export async function comparePeers(id: string, type: Kind, limit = 4): Promise<FintechListItem[]> {
  const list = type === "exchange" ? await getTopExchanges(limit + 4) : await getTopNeobanks(limit + 4);
  return list.filter((f) => f.id !== id).slice(0, limit);
}

export async function featuredPairs(topN = 6): Promise<{ pair: string; type: Kind }[]> {
  const [nb, ex] = await Promise.all([getTopNeobanks(topN), getTopExchanges(topN)]);
  const combos = (ids: string[], type: Kind) => {
    const out: { pair: string; type: Kind }[] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) out.push({ pair: pairSlug(ids[i], ids[j]), type });
    return out;
  };
  return [...combos(nb.map((f) => f.id), "neobank"), ...combos(ex.map((f) => f.id), "exchange")];
}

export interface FeaturedComparison {
  pair: string;
  a: Pick<FintechListItem, "id" | "name" | "logoSvg" | "website">;
  b: Pick<FintechListItem, "id" | "name" | "logoSvg" | "website">;
}

/** Featured pairs with each side's name + logo, for the /compare/ index page. */
export async function featuredComparisons(topN = 6): Promise<{ neobank: FeaturedComparison[]; exchange: FeaturedComparison[] }> {
  const [nb, ex] = await Promise.all([getTopNeobanks(topN), getTopExchanges(topN)]);
  const combos = (list: FintechListItem[]): FeaturedComparison[] => {
    const out: FeaturedComparison[] = [];
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = list[i].id < list[j].id ? [list[i], list[j]] : [list[j], list[i]];
        const pick = (f: FintechListItem) => ({ id: f.id, name: f.name, logoSvg: f.logoSvg, website: f.website });
        out.push({ pair: pairSlug(a.id, b.id), a: pick(a), b: pick(b) });
      }
    return out;
  };
  return { neobank: combos(nb), exchange: combos(ex) };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Higher-is-better numeric comparison with a small tolerance for ties. */
function cmp(a: number | null, b: number | null, tol = 0): Winner {
  if (a == null && b == null) return null;
  if (a == null) return "b";
  if (b == null) return "a";
  if (Math.abs(a - b) <= tol) return "tie";
  return a > b ? "a" : "b";
}

async function loadSide(id: string, locale?: string): Promise<{ side: CompareSide; type: Kind } | null> {
  const ft = await getFintech(id, locale);
  if (!ft) return null;
  const [si, ratings, mica] = await Promise.all([
    getSentimentIndex(id),
    getPlatformRatings(id),
    getMicaStatus(id),
  ]);

  const conf = (ft.factConfidence && typeof ft.factConfidence === "object" ? ft.factConfidence : {}) as Record<string, string>;
  const ok = (f: string) => conf[f] === "high";

  const byKind = new Map(ratings.map((r) => [r.kind, r]));
  const ratingMap = Object.fromEntries(
    PLATFORMS.map((k) => {
      const r = byKind.get(k);
      return [k, { rating: r?.rating ?? null, count: r?.count ?? null, pos: r?.pos ?? null }];
    }),
  ) as CompareSide["ratings"];
  const reviewVolume = PLATFORMS.reduce((s, k) => s + (ratingMap[k].count ?? 0), 0);

  return {
    type: (ft.type === "exchange" ? "exchange" : "neobank") as Kind,
    side: {
      id: ft.id,
      name: ft.name,
      country: ok("country") ? ft.country : null,
      logoSvg: ft.logoSvg ?? null,
      website: ft.website ?? null,
      founded: ok("founded") ? ft.founded : null,
      headquarters: ok("headquarters") ? ft.headquarters : null,
      status: ok("status") ? ft.status : null,
      ownership: ok("ownership") ? ft.ownership : null,
      tags: Array.isArray(ft.tags) ? ft.tags : [],
      showCompanyFacts: !HIDE_COMPANY_FACTS.has(ft.id),
      sentiment: si ? Math.round(si.latest.composite) : null,
      sentimentDelta: si?.deltaWoW ?? null,
      ratings: ratingMap,
      reviewVolume,
      mica,
    },
  };
}

function avg(...vals: (number | null)[]): number | null {
  const v = vals.filter((x): x is number => x != null);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
}

/**
 * Build a comparison of two same-type fintechs, or null if either is missing or
 * they are different types (a neobank and an exchange don't compare cleanly).
 */
export async function getComparison(aId: string, bId: string, locale?: string): Promise<Comparison | null> {
  const [ra, rb] = await Promise.all([loadSide(aId, locale), loadSide(bId, locale)]);
  if (!ra || !rb || ra.type !== rb.type) return null;
  const a = ra.side;
  const b = rb.side;
  const type = ra.type;

  const metrics: CompareMetric[] = [];

  // Sentiment
  metrics.push({ key: "sentiment", section: "sentiment", a: a.sentiment, b: b.sentiment, win: cmp(a.sentiment, b.sentiment, 1), kind: "score" });

  // Ratings per platform (rating drives the winner; count shown alongside).
  for (const k of PLATFORMS) {
    metrics.push({
      key: k,
      section: "ratings",
      a: a.ratings[k].rating,
      b: b.ratings[k].rating,
      win: cmp(a.ratings[k].rating, b.ratings[k].rating, 0.05),
      kind: "rating",
    });
  }
  metrics.push({ key: "reviewVolume", section: "ratings", a: a.reviewVolume || null, b: b.reviewVolume || null, win: cmp(a.reviewVolume || null, b.reviewVolume || null), kind: "count" });

  // Company facts (both must clear the trust gate + brand not hidden).
  const showCompany = a.showCompanyFacts && b.showCompanyFacts;
  if (showCompany) {
    // Older = more established → older wins.
    const foundedWin: Winner = a.founded && b.founded ? (a.founded === b.founded ? "tie" : a.founded < b.founded ? "a" : "b") : a.founded ? "a" : b.founded ? "b" : null;
    metrics.push({ key: "founded", section: "company", a: a.founded, b: b.founded, win: foundedWin, kind: "year" });
    metrics.push({ key: "country", section: "company", a: a.country, b: b.country, win: null, kind: "text" });
    metrics.push({ key: "headquarters", section: "company", a: a.headquarters, b: b.headquarters, win: null, kind: "text" });
    metrics.push({ key: "status", section: "company", a: a.status, b: b.status, win: null, kind: "text" });
  }

  // MiCA (exchanges only): licensed beats unlicensed; then more services.
  if (type === "exchange") {
    const micaWin: Winner = a.mica.licensed !== b.mica.licensed ? (a.mica.licensed ? "a" : "b") : a.mica.licensed ? cmp(a.mica.services.length, b.mica.services.length) : null;
    metrics.push({ key: "mica", section: "mica", a: a.mica.licensed, b: b.mica.licensed, win: micaWin, kind: "bool" });
    if (a.mica.licensed || b.mica.licensed) {
      metrics.push({ key: "regulator", section: "mica", a: a.mica.regulator, b: b.mica.regulator, win: null, kind: "text" });
      metrics.push({ key: "micaServices", section: "mica", a: a.mica.services.length || null, b: b.mica.services.length || null, win: cmp(a.mica.services.length || null, b.mica.services.length || null), kind: "services" });
    }
  }

  // Top winner boxes.
  const winnerBoxes: WinnerBox[] = [];
  const push = (key: WinnerBox["key"], w: Winner) => { if (w && w !== null) winnerBoxes.push({ key, win: w }); };
  push("sentiment", cmp(a.sentiment, b.sentiment, 1));
  push("ratings", cmp(avg(...PLATFORMS.map((k) => a.ratings[k].rating)), avg(...PLATFORMS.map((k) => b.ratings[k].rating)), 0.05));
  push("app", cmp(avg(a.ratings.google_play.rating, a.ratings.app_store.rating), avg(b.ratings.google_play.rating, b.ratings.app_store.rating), 0.05));
  push("reviews", cmp(a.reviewVolume || null, b.reviewVolume || null));
  if (type === "exchange") {
    const micaW: Winner = a.mica.licensed !== b.mica.licensed ? (a.mica.licensed ? "a" : "b") : a.mica.licensed ? cmp(a.mica.services.length, b.mica.services.length) : null;
    push("regulation", micaW);
  }

  const aWins = metrics.filter((m) => m.win === "a").length;
  const bWins = metrics.filter((m) => m.win === "b").length;

  return { type, a, b, metrics, winnerBoxes, aWins, bWins };
}
