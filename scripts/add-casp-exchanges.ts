/**
 * Expand the exchange directory from the MiCA/CASP register. Of the CASP
 * providers that offer an exchange service (crypto↔cash / crypto↔crypto),
 * Claude picks the genuine RETAIL consumer exchanges/apps we don't yet track,
 * and we create a profile record for each (type=exchange), linked to its CASP
 * row. Factual fields are left thin — the Wikipedia refresh enriches them, and
 * BrandLogo shows their favicon.
 *
 *   npm run casp:exchanges          # apply
 *   npm run casp:exchanges -- dry   # print the selection only
 */

import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";
import { COUNTRY_ISO } from "../lib/mica/reference.ts";

const DRY = process.argv[2] === "dry";
if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const EXCHANGE_SVC = /crypto\s*<->\s*(crypto|cash)/i;
const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "x";
const bareHost = (w?: string | null) =>
  (w ?? "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/.*$/, "").trim().toLowerCase();
// Second-level label, e.g. gate.io / gate.com / gate.eu → "gate" — so brand EU
// variants dedupe against a tracked exchange regardless of TLD/path.
const hostRoot = (w?: string | null) => bareHost(w).split(".")[0] ?? "";

// ── existing exchanges (dedupe target) ──
const tracked = await db.execute(sql`select id, name, website from fintechs where type='exchange'`);
const trackedNames = new Set((tracked.rows as any[]).map((r) => (r.name as string).toLowerCase()));
const trackedHosts = new Set((tracked.rows as any[]).map((r) => bareHost(r.website)).filter(Boolean));
const trackedRoots = new Set((tracked.rows as any[]).map((r) => hostRoot(r.website)).filter(Boolean));
const existingIds = new Set((tracked.rows as any[]).map((r) => r.id as string));

// ── CASP providers offering an exchange service ──
const casps = (await db.select().from(schema.caspProviders)).filter((c) =>
  (c.services ?? []).some((s) => EXCHANGE_SVC.test(s)),
);
const candidates = casps.filter((c) => {
  const host = bareHost(c.website);
  return !trackedNames.has(c.provider.toLowerCase()) && !(host && trackedHosts.has(host));
});
console.log(`exchange-service CASPs: ${casps.length}; not already tracked: ${candidates.length}`);

const list = candidates
  .map((c) => `${c.id} | ${c.provider} | ${c.legalEntity ?? ""} | ${c.country} | ${bareHost(c.website)}`)
  .join("\n");

const SYSTEM =
  "You curate a public directory of crypto EXCHANGES. From MiCA-registered providers, select ONLY the genuine " +
  "RETAIL consumer crypto exchanges or trading apps — a normal person can sign up and buy/trade crypto. " +
  "EXCLUDE: institutional/OTC-only desks, custodians, brokers/banks where retail crypto trading isn't a core " +
  "product, market-makers, white-label/infrastructure providers, asset managers, and obscure shells with no real " +
  "consumer brand. Prefer recognisable consumer brands. Respond with ONLY a JSON array of objects " +
  `{ "caspId": <number>, "name": "<clean brand name>", "slug": "<short-url-slug>", "website": "<bare domain>" } ` +
  "for the ones worth a standalone profile.";

console.log("asking Claude to classify…");
const res = await anthropic().messages.create(
  { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 8000, system: SYSTEM,
    messages: [{ role: "user", content: `CANDIDATES (caspId | provider | legal entity | country | domain):\n${list}\n\nReturn the retail consumer crypto exchanges worth a profile as a JSON array.` }] },
  { timeout: 120_000, maxRetries: 1 },
);
const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
const m = text.match(/\[[\s\S]*\]/);
if (!m) { console.log("no JSON:", text.slice(0, 400)); process.exit(1); }
const picks = JSON.parse(m[0]) as { caspId: number; name: string; slug: string; website: string }[];

const byCaspId = new Map(candidates.map((c) => [c.id, c]));
const usedIds = new Set(existingIds);
let added = 0;
const report: string[] = [];
for (const p of picks) {
  const casp = byCaspId.get(p.caspId);
  if (!casp) continue;
  const pickRoot = hostRoot(p.website) || hostRoot(casp.website);
  if (trackedNames.has(p.name.toLowerCase()) || (pickRoot && trackedRoots.has(pickRoot))) {
    report.push(`SKIP (already tracked): ${p.name}`);
    continue;
  }
  let id = slugify(p.slug || p.name);
  while (usedIds.has(id)) id = `${id}-x`;
  usedIds.add(id);
  const iso = COUNTRY_ISO[casp.country] ?? null;
  const host = bareHost(p.website) || bareHost(casp.website) || null;
  report.push(`${id} | ${p.name} | ${host ?? ""} | ${casp.country}${iso ? ` (${iso})` : ""}`);
  if (DRY) continue;
  await db.insert(schema.fintechs).values({
    id, type: "exchange", name: p.name, website: host, country: iso,
    status: "active", tags: [], caspProviderId: casp.id,
  }).onConflictDoNothing();
  added++;
}
console.log(`\n${DRY ? "would add" : "added"} ${DRY ? report.length : added} exchanges:\n${report.join("\n")}`);
process.exit(0);
