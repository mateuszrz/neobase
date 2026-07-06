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

/** Fintechs whose mobile sources aren't live yet (no active google_play/app_store). */
const targets = await db
  .select({ id: fintechs.id, name: fintechs.name, website: fintechs.website, country: fintechs.country })
  .from(fintechs)
  .where(
    sql`NOT EXISTS (SELECT 1 FROM ${sources} s WHERE s.fintech_id = ${fintechs.id}
        AND s.kind IN ('google_play','app_store') AND s.active = true)`,
  )
  .limit(LIMIT);

console.log(`${DRY ? "[DRY] " : ""}Resolving app ids for ${targets.length} fintechs…\n`);

const client = apify();

async function search(actor: string, input: Record<string, unknown>): Promise<Record<string, any>[]> {
  const run = await client.actor(actor).call(input, { waitSecs: 120 });
  const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 8 });
  return items as Record<string, any>[];
}

interface Match {
  id: string;
  name: string;
  gp: { appId: string; developer: string; via: string } | null;
  as: { id: string; developer: string; via: string } | null;
}

async function resolve(ft: { id: string; name: string; website: string | null; country: string | null }): Promise<Match> {
  const dom = regDomain(ft.website);
  const token = (dom?.split(".")[0] ?? ft.id).toLowerCase();
  const hit = (s: unknown) => typeof s === "string" && token.length >= 3 && s.toLowerCase().includes(token);
  // Search the fintech's home-country storefront — regional apps (illimity/it,
  // imagin/es) don't surface in the US store, and Binance-global isn't there.
  const country = (ft.country ?? "us").toLowerCase();

  const [gpRes, asRes] = await Promise.all([
    search(env.APIFY_GOOGLE_PLAY_ACTOR, { mode: "search", searchTerms: [ft.name], maxResults: 6, country, language: "en" }).catch(() => []),
    search(env.APIFY_APPSTORE_ACTOR, { mode: "search", query: ft.name, maxResults: 6, country }).catch(() => []),
  ]);

  // Google Play: prefer exact developer-domain match, else brand-token match.
  let gp: Match["gp"] = null;
  const gpDomain = gpRes.find((c) => dom && regDomain(c.developerWebsite) === dom);
  const gpToken = gpRes.find((c) => hit(c.developerWebsite) || hit(c.developer) || hit(c.title) || hit(c.appId));
  const gpPick = gpDomain ?? gpToken;
  if (gpPick) gp = { appId: String(gpPick.appId), developer: gpPick.developer ?? "", via: gpDomain ? "domain" : "token" };

  // App Store: no company URL in search → match brand token, and prefer a
  // candidate whose developer matches the Google-Play-verified developer.
  let as: Match["as"] = null;
  const gpDev = gp?.developer?.toLowerCase();
  const asDev = gpDev ? asRes.find((c) => hit(c.appId) || hit(c.title) ? String(c.developer ?? "").toLowerCase().split(" ")[0] === gpDev.split(" ")[0] : false) : null;
  const asToken = asRes.find((c) => hit(c.appId) || hit(c.title) || hit(c.developer));
  const asPick = asDev ?? asToken;
  if (asPick) as = { id: String(asPick.id), developer: asPick.developer ?? "", via: asDev ? "gp-dev" : "token" };

  return { id: ft.id, name: ft.name, gp, as };
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
const gpHigh = (r: Match) => r.gp?.via === "domain";
const asHigh = (r: Match) => r.as?.via === "gp-dev";

let hi = 0;
const low: string[] = [];
for (const r of results) {
  if (!r.gp && !r.as) continue;
  const parts: string[] = [];
  if (r.gp) parts.push(`GP ${r.gp.appId}${gpHigh(r) ? "" : " ?"}`);
  if (r.as) parts.push(`AS ${r.as.id}${asHigh(r) ? "" : " ?"}`);
  const trusted = (r.gp && gpHigh(r)) || (r.as && asHigh(r));
  if (trusted) hi++;
  else low.push(r.id);
  console.log(`  ${trusted ? "✓" : "?"} ${r.id.padEnd(16)} ${parts.join("  ")}`);
}
console.log(`\nTrusted (auto-activate): ${hi}. Token-only (review): ${low.length}${low.length ? " — " + low.join(", ") : ""}.`);

if (!DRY) {
  let wrote = 0;
  for (const r of results) {
    const pairs: [("google_play" | "app_store"), string | undefined][] = [
      ["google_play", gpHigh(r) ? r.gp!.appId : undefined],
      ["app_store", asHigh(r) ? r.as!.id : undefined],
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
