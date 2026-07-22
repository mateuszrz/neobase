/**
 * Discover Google Play + App Store app ids for fintechs via the actors' `search`
 * mode, matched by developer domain / brand token so we don't attach the wrong
 * app. Google Play search returns `developerWebsite` → matched against the
 * fintech's registrable domain (strong). App Store search has no company URL, so
 * we match the brand token in developer/title/bundle (medium) and prefer a
 * candidate whose developer matches the Google-Play-verified developer.
 *
 *   npm run apify:appids -- dry 15     # dry-run report, first 15 fintechs
 *   npm run apify:appids               # full run, writes sources (active=true)
 */

import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { apify } from "../lib/apify/index.ts";
import { env, isApifyLive } from "../lib/env.ts";

const { sources, fintechs } = schema;
const DRY = process.argv[2] === "dry";
const LIMIT = Number(process.argv[3] ?? (DRY ? 15 : 100000));

if (!isApifyLive() || !env.APIFY_GOOGLE_PLAY_ACTOR || !env.APIFY_APPSTORE_ACTOR) {
  console.error("APIFY_TOKEN + Google Play & App Store actors must be set.");
  process.exit(1);
}

const MULTI_TLD = new Set([
  "co.uk", "com.br", "co.jp", "com.au", "co.za", "com.mx", "co.in", "com.tr",
  "com.sg", "com.hk", "co.kr", "com.vn", "com.ph", "com.co", "com.ng", "co.id",
]);

function regDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const p = host.split(".");
  if (p.length < 2) return null;
  return MULTI_TLD.has(p.slice(-2).join(".")) && p.length >= 3 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}

/**
 * Normalise a store developer name to its brand core for cross-store comparison:
 * lower-case, strip punctuation, then drop the corporate suffixes the two stores
 * apply inconsistently. "Coinbase, Inc." and "Coinbase Inc" both collapse to
 * "coinbase"; "Payward, Inc." (Kraken's legal entity on Google Play) stays
 * "payward" and correctly fails to match the App Store's "Kraken", leaving that
 * one for manual review rather than a wrong auto-attach.
 */
const CORP = /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|s ?a|ag|plc|oy|ab|as|bv|nv|srl|spa|group|holdings?|technologies|technology|labs?|services|software)\b/g;
const normDev = (s: string | null | undefined): string =>
  String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(CORP, " ").replace(/\s+/g, " ").trim();

/**
 * Fintechs missing a live source for EITHER store — evaluated per kind.
 *
 * This used to require that no mobile source at all was active, which created a
 * blind spot the size of the problem it was meant to solve: a brand with Google
 * Play live and App Store still on its seeded placeholder was considered done
 * and could never be repaired by re-running this. 51 of 174 fintechs sat in
 * that state, Coinbase (no App Store) and Binance (no Google Play) among them.
 *
 * `needsGp` / `needsAs` also gate the writes below, so a store that is already
 * live is never overwritten by a fresh search result.
 */
const liveFor = (kind: string) =>
  sql`EXISTS (SELECT 1 FROM ${sources} s WHERE s.fintech_id = ${fintechs.id}
      AND s.kind = ${kind} AND s.active = true)`;

const targets = await db
  .select({
    id: fintechs.id,
    name: fintechs.name,
    website: fintechs.website,
    country: fintechs.country,
    needsGp: sql<boolean>`NOT ${liveFor("google_play")}`,
    needsAs: sql<boolean>`NOT ${liveFor("app_store")}`,
  })
  .from(fintechs)
  .where(sql`NOT ${liveFor("google_play")} OR NOT ${liveFor("app_store")}`)
  .limit(LIMIT);

console.log(`${DRY ? "[DRY] " : ""}Resolving app ids for ${targets.length} fintechs…\n`);

const client = apify();

async function search(actor: string, input: Record<string, unknown>): Promise<Record<string, any>[]> {
  const run = await client.actor(actor).call(input, { waitSecs: 120 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 8 });
  return items as Record<string, any>[];
}

/**
 * Search the home storefront first, then fall back to the global US/GB stores —
 * but only when the home storefront lists nothing at all. Many EU crypto
 * exchanges are registered under a small jurisdiction (mt/cy/lv/sc) whose App
 * Store returns zero results while the brand ships a single global app; the App
 * Store id is storefront-independent, so a fallback hit is the same id. The
 * empty-only trigger keeps this additive: a regional app that *does* surface at
 * home (imagin/es, illimity/it) is never displaced by a US look-alike.
 */
const FALLBACK_STORES = ["us", "gb"];
async function searchStores(
  actor: string,
  input: (country: string) => Record<string, unknown>,
  home: string,
): Promise<{ rows: Record<string, any>[]; home: boolean }> {
  const tried = new Set<string>();
  const order = [home, ...FALLBACK_STORES];
  for (let i = 0; i < order.length; i++) {
    const c = order[i];
    if (tried.has(c)) continue;
    tried.add(c);
    const res = await search(actor, input(c)).catch(() => []);
    if (res.length) return { rows: res, home: i === 0 };
  }
  return { rows: [], home: true };
}

interface Match {
  id: string;
  name: string;
  needsGp: boolean;
  needsAs: boolean;
  gp: { appId: string; developer: string; via: string } | null;
  as: { id: string; developer: string; via: string } | null;
}

/**
 * Both stores are searched even when only one is missing: the App Store has no
 * company URL in its search results, so the only strong signal for it is a
 * developer name matching the domain-verified Google Play result. Dropping the
 * Google Play search would downgrade every App Store match to a brand-token
 * guess, which this script deliberately refuses to auto-activate.
 */
async function resolve(ft: {
  id: string; name: string; website: string | null; country: string | null;
  needsGp: boolean; needsAs: boolean;
}): Promise<Match> {
  const dom = regDomain(ft.website);
  const token = (dom?.split(".")[0] ?? ft.id).toLowerCase();
  const hit = (s: unknown) => typeof s === "string" && token.length >= 3 && s.toLowerCase().includes(token);
  // Search the fintech's home-country storefront — regional apps (illimity/it,
  // imagin/es) don't surface in the US store, and Binance-global isn't there.
  const country = (ft.country ?? "us").toLowerCase();

  // A fallback-store hit is only ever reported, never auto-activated: the global
  // US/GB stores are where clones and unrelated look-alikes of small-jurisdiction
  // exchanges proliferate (a lookup once returned Houston's *trash-pickup* app for
  // "HTX"), and the real global exchange app is often absent there too. Trust
  // stays anchored to the home storefront; fallback results wait for human eyes.
  const [gpr, asr] = await Promise.all([
    searchStores(env.APIFY_GOOGLE_PLAY_ACTOR, (c) => ({ mode: "search", searchTerms: [ft.name], maxResults: 6, country: c, language: "en" }), country),
    searchStores(env.APIFY_APPSTORE_ACTOR, (c) => ({ mode: "search", query: ft.name, maxResults: 6, country: c }), country),
  ]);
  const gpRes = gpr.rows;
  const asRes = asr.rows;

  // Google Play: exact developer-domain match, else the dev domain's brand label
  // CONTAINS the token (getchip.uk ⊃ "chip"; rejects unrelated dev domains), else
  // a plain brand-token match (untrusted).
  const devLabel = (c: any): string => {
    const d = regDomain(c.developerWebsite);
    return d ? d.split(".")[0].toLowerCase() : "";
  };
  let gp: Match["gp"] = null;
  const gpDomain = gpRes.find((c) => dom && regDomain(c.developerWebsite) === dom);
  const gpDomainToken = gpRes.find((c) => token.length >= 4 && devLabel(c).includes(token));
  const gpToken = gpRes.find((c) => hit(c.developerWebsite) || hit(c.developer) || hit(c.title) || hit(c.appId));
  const gpPick = gpDomain ?? gpDomainToken ?? gpToken;
  if (gpPick) {
    gp = { appId: String(gpPick.appId), developer: gpPick.developer ?? "", via: gpDomain ? "domain" : gpDomainToken ? "domain-token" : "token" };
  }

  // App Store: no company URL in search → match brand token, and prefer a
  // candidate whose developer matches the Google-Play-verified developer.
  // Developer names are normalised before comparison: the two stores punctuate
  // and suffix the same legal entity differently ("Coinbase Inc" on Google Play
  // vs "Coinbase, Inc." on the App Store), so a raw first-word compare missed
  // every real match. Corporate suffixes are dropped so the brand token is what
  // actually gets compared.
  let as: Match["as"] = null;
  const gpDev = gp ? normDev(gp.developer) : "";
  const asDev = gpDev ? asRes.find((c) => (hit(c.appId) || hit(c.title)) && normDev(c.developer) === gpDev) : null;
  const asToken = asRes.find((c) => hit(c.appId) || hit(c.title) || hit(c.developer));
  const asPick = asDev ?? asToken;
  if (asPick) as = { id: String(asPick.id), developer: asPick.developer ?? "", via: asDev ? "gp-dev" : "token" };

  // Demote any fallback-store hit to the untrusted "token" tier so it is reported
  // but never auto-activated (see the searchStores note above).
  if (gp && !gpr.home) gp.via = "token";
  if (as && !asr.home) as.via = "token";

  return { id: ft.id, name: ft.name, needsGp: ft.needsGp, needsAs: ft.needsAs, gp, as };
}

function chunk<T>(a: T[], n: number): T[][] {
  const o: T[][] = [];
  for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n));
  return o;
}

const results: Match[] = [];
for (const batch of chunk(targets, 6)) {
  results.push(...(await Promise.all(batch.map(resolve))));
  process.stdout.write(`  …${results.length}/${targets.length}\r`);
}
console.log("\n");

// Only domain-verified GP and GP-developer-verified AS matches are trusted for
// auto-activation; brand-token-only matches are reported for manual review.
const gpHigh = (r: Match) => r.gp?.via === "domain" || r.gp?.via === "domain-token";
// An App Store match is only trusted when it was verified against a Google Play
// developer that was itself domain-verified — otherwise gp-dev is circular (a
// token-only GP guess validating a token-only AS guess).
const asHigh = (r: Match) => r.as?.via === "gp-dev" && gpHigh(r);

let hi = 0;
const low: string[] = [];
for (const r of results) {
  if (!r.gp && !r.as) continue;
  const parts: string[] = [];
  // "live" marks a store we did not need and will not touch, so the report
  // cannot be read as "this is about to be written".
  if (r.gp) parts.push(`GP ${r.gp.appId}${r.needsGp ? (gpHigh(r) ? "" : " ?") : " (live)"}`);
  if (r.as) parts.push(`AS ${r.as.id}${r.needsAs ? (asHigh(r) ? "" : " ?") : " (live)"}`);
  const trusted = (r.needsGp && r.gp && gpHigh(r)) || (r.needsAs && r.as && asHigh(r));
  if (trusted) hi++;
  else low.push(r.id);
  console.log(`  ${trusted ? "✓" : "?"} ${r.id.padEnd(16)} ${parts.join("  ")}`);
}
console.log(`\nTrusted (auto-activate): ${hi}. Token-only (review): ${low.length}${low.length ? " — " + low.join(", ") : ""}.`);

if (!DRY) {
  let wrote = 0;
  for (const r of results) {
    // A store that is already live is never rewritten: `needs*` gates it, so a
    // weaker search result cannot displace a working app id.
    const pairs: [("google_play" | "app_store"), string | undefined][] = [
      ["google_play", r.needsGp && gpHigh(r) ? r.gp!.appId : undefined],
      ["app_store", r.needsAs && asHigh(r) ? r.as!.id : undefined],
    ];
    for (const [kind, appId] of pairs) {
      if (!appId) continue;
      const upd = await db.update(sources).set({ externalRef: appId, active: true })
        .where(and(eq(sources.fintechId, r.id), eq(sources.kind, kind), eq(sources.country, "ZZ")))
        .returning({ id: sources.id });
      if (!upd.length) await db.insert(sources).values({ fintechId: r.id, kind, externalRef: appId, country: "ZZ", active: true });
      wrote++;
    }
  }
  console.log(`Wrote ${wrote} trusted sources (active).`);
}
process.exit(0);
