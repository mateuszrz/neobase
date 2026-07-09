/**
 * Import / upsert fintech profiles from a JSON file, and wire up their public
 * collection sources so the weekly cron starts gathering data.
 *
 *   npm run fintechs:import -- path/to/fintechs.json
 *   npm run fintechs:import -- path/to/fintechs.json --dry
 *
 * File format: a JSON array of records. Only `name` is required; everything else
 * is optional but drives coverage:
 *
 * [
 *   {
 *     "name": "Revolut",                 // required
 *     "id": "revolut",                   // optional slug (else derived from name)
 *     "type": "neobank",                 // neobank | exchange (default neobank)
 *     "country": "GB",                   // ISO2
 *     "website": "https://www.revolut.com",
 *     "trustpilot": "revolut.com",       // Trustpilot company domain (else derived from website)
 *     "googlePlay": "com.revolut.revolut",
 *     "appStore": "932493382",           // numeric App Store id
 *     "blog": "https://www.revolut.com/blog", // optional; else website + /blog
 *     "description": "…", "about": "…",
 *     "tags": ["multi-currency","crypto"],
 *     "logoUrl": "https://…", "founded": 2015, "headquarters": "London, UK",
 *     "socials": { "linkedin": "https://linkedin.com/company/revolut", "facebook": "…" }
 *   }
 * ]
 *
 * Idempotent: fintechs upsert by id; sources upsert by natural key. Re-running
 * with a corrected file fixes the data. Missing app ids can be filled later with
 * `npm run apify:appids`.
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const { fintechs, sources } = schema;

const file = process.argv[2];
const DRY = process.argv.includes("--dry");
if (!file || file.startsWith("--")) {
  console.error("usage: fintechs:import -- <path.json> [--dry]");
  process.exit(1);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const MULTI_TLD = new Set(["co.uk", "com.br", "co.jp", "com.au", "co.za", "com.mx", "co.in", "com.tr", "com.sg", "com.hk", "co.kr", "com.vn", "com.ph", "com.co", "com.ng", "co.id", "com.pl"]);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "fintech";
}
function iso2(v: unknown): string | null {
  return typeof v === "string" && v.trim().length === 2 ? v.trim().toUpperCase() : null;
}
function withScheme(url: string): string {
  const s = url.trim();
  return /^https?:\/\//i.test(s) ? s : `https://${s.replace(/^\/+/, "")}`;
}
function regDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  const host = String(url).replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].toLowerCase();
  const p = host.split(".");
  if (p.length < 2) return null;
  return MULTI_TLD.has(p.slice(-2).join(".")) && p.length >= 3 ? p.slice(-3).join(".") : p.slice(-2).join(".");
}
/** Fix malformed base64 data-URI logos (missing comma), else pass through. */
function normalizeLogo(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return v.includes(";base64,") ? v : v.replace(";base64", ";base64,");
}

interface Rec {
  name: string;
  id?: string;
  type?: string;
  country?: string;
  website?: string;
  trustpilot?: string;
  googlePlay?: string;
  appStore?: string;
  blog?: string;
  description?: string;
  about?: string;
  tags?: string[];
  logoUrl?: string;
  founded?: number;
  headquarters?: string;
  socials?: Record<string, string>;
}

const raw = JSON.parse(readFileSync(file, "utf8"));
const records: Rec[] = Array.isArray(raw) ? raw : raw?.fintechs ?? [];
if (!records.length) {
  console.error("no records found (expected a JSON array of fintech objects)");
  process.exit(1);
}

// ─── source upserts ──────────────────────────────────────────────────────────

async function upsertSource(fintechId: string, kind: string, externalRef: string) {
  const upd = await db
    .update(sources)
    .set({ externalRef, active: true, scope: "public", cadence: "weekly" })
    .where(and(eq(sources.fintechId, fintechId), eq(sources.kind, kind), eq(sources.country, "ZZ")))
    .returning({ id: sources.id });
  if (!upd.length) {
    await db
      .insert(sources)
      .values({ fintechId, kind, externalRef, country: "ZZ", scope: "public", cadence: "weekly", active: true })
      .onConflictDoNothing({ target: [sources.fintechId, sources.kind, sources.externalRef, sources.country] });
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────

let upserted = 0;
let srcCount = 0;
const perKind: Record<string, number> = {};

for (const r of records) {
  if (!r.name?.trim()) continue;
  const id = (r.id?.trim() || slugify(r.name)).toLowerCase();
  const website = r.website ? withScheme(r.website) : null;
  const values = {
    id,
    type: r.type === "exchange" ? "exchange" : "neobank",
    name: r.name.trim(),
    country: iso2(r.country),
    website,
    description: r.description ?? null,
    about: r.about ?? null,
    tags: Array.isArray(r.tags) ? r.tags : null,
    logoSvg: normalizeLogo(r.logoUrl),
    founded: typeof r.founded === "number" ? r.founded : null,
    headquarters: r.headquarters ?? null,
    socials: r.socials && typeof r.socials === "object" ? r.socials : null,
    updatedAt: new Date(),
  };

  // Which collection sources to create for this fintech.
  const trustpilot = r.trustpilot?.trim() || regDomain(website);
  const blogUrl = r.blog ? withScheme(r.blog) : website ? `${website.replace(/\/+$/, "")}/blog` : null;
  const srcs: [string, string | null][] = [
    ["trustpilot", trustpilot],
    ["google_play", r.googlePlay?.trim() || null],
    ["app_store", r.appStore?.trim() || null],
    ["homepage", website],
    ["blog", blogUrl],
    ["social_linkedin", r.socials?.linkedin ?? null],
    ["social_facebook", r.socials?.facebook ?? null],
  ];

  if (DRY) {
    const have = srcs.filter(([, v]) => v).map(([k]) => k);
    console.log(`  [dry] ${id.padEnd(18)} sources: ${have.join(", ") || "(none)"}`);
    upserted++;
    continue;
  }

  await db
    .insert(fintechs)
    .values(values)
    .onConflictDoUpdate({ target: fintechs.id, set: values });
  upserted++;

  for (const [kind, ref] of srcs) {
    if (!ref) continue;
    await upsertSource(id, kind, ref);
    srcCount++;
    perKind[kind] = (perKind[kind] ?? 0) + 1;
  }
}

console.log(
  `\n${DRY ? "[DRY] " : ""}${upserted}/${records.length} fintechs${DRY ? " (would upsert)" : " upserted"}` +
    (DRY ? "" : ` · ${srcCount} sources (${Object.entries(perKind).map(([k, n]) => `${k}:${n}`).join(", ")})`),
);
if (!DRY) console.log("Next: `npm run apify:appids` fills missing store ids; the weekly-public cron starts collecting.");
process.exit(0);
