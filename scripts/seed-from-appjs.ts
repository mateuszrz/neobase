/**
 * Seeds Neon from the legacy bundle's hardcoded data.
 *
 *   npm run seed
 *
 * Idempotent: fintechs upsert on id, sources use a deterministic UUID (uuidv5-style
 * over the natural key), metric_snapshots upsert on (source, country, date).
 * Re-running is a no-op beyond refreshing mutable fields.
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { db, schema } from "../lib/db/index.ts";
import { loadAppJsData, parseEmployees, parseValuation } from "../lib/seed/appjs.ts";

const { fintechs, sources, metricSnapshots } = schema;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_JS = path.join(__dirname, "seed-data", "app.js");

const PLATFORMS = [
  { kind: "trustpilot", rating: "trustpilot", count: "trustpilotReviews" },
  { kind: "google_play", rating: "googlePlay", count: "googlePlayReviews" },
  { kind: "app_store", rating: "appStore", count: "appStoreReviews" },
] as const;

/** Deterministic UUID (v5-shaped) from an arbitrary string, so seeds are stable. */
function detUuid(input: string): string {
  const h = createHash("sha1").update(input).digest("hex").slice(0, 32).split("");
  h[12] = "5"; // version
  h[16] = "89ab"[parseInt(h[16], 16) % 4]; // variant
  const s = h.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Fix malformed base64 data-URI logos from app.js (missing comma: `;base64PHN…`). */
function normalizeLogo(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  return v.includes(";base64,") ? v : v.replace(";base64", ";base64,");
}

function iso2(v: unknown): string | null {
  return typeof v === "string" && v.length === 2 ? v.toUpperCase() : null;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Keep the last row per key — Postgres rejects an upsert that hits a row twice in one command. */
function dedupeBy<T>(rows: T[], key: (r: T) => string): T[] {
  const map = new Map<string, T>();
  for (const r of rows) map.set(key(r), r);
  return [...map.values()];
}

type FintechRow = typeof fintechs.$inferInsert;
type SourceRow = typeof sources.$inferInsert;
type SnapshotRow = typeof metricSnapshots.$inferInsert;

function buildEntity(
  raw: Record<string, any>,
  type: "neobank" | "exchange",
  acc: { fintechRows: FintechRow[]; sourceRows: SourceRow[]; snapRows: SnapshotRow[] },
) {
  const id = String(raw.id);
  const website: string | null = typeof raw.website === "string" ? raw.website : null;

  acc.fintechRows.push({
    id,
    type,
    name: String(raw.name ?? id),
    country: iso2(raw.country),
    logoSvg: normalizeLogo(raw.logoUrl),
    color: raw.color ?? null,
    website,
    founded: typeof raw.founded === "number" ? raw.founded : null,
    headquarters: raw.headquarters ?? null,
    employees: parseEmployees(raw.employees),
    valuationUsd: parseValuation(raw.valuation),
    // The bundle's `status` is really an ownership fact ("Private", "Public
    // (NASDAQ: PYPL)", "Unicorn"), so it lands in `ownership`; our own `status`
    // column is lifecycle-only and stays empty until something verifies it.
    // It used to fall back to raw.regulation — a subjective regulation-strength
    // rating ("Very High" … "Low") — which is never a status. Don't reinstate.
    status: null,
    ownership: raw.status ?? null,
    description: raw.description ?? null,
    about: raw.about ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : Array.isArray(raw.types) ? raw.types : null,
    availableIn: Array.isArray(raw.availableIn)
      ? raw.availableIn.map(iso2).filter((x): x is string => !!x)
      : null,
    licenses: raw.licenses ?? null,
    socials: raw.socials ?? null,
    keyPeople: raw.keyPeople ?? null,
    investors: raw.investors ?? null,
    subsidiaries: raw.subsidiaries ?? null,
    history: raw.history ?? null,
    faqs: raw.faqs ?? null,
  });

  const snapshots: any[] = Array.isArray(raw.snapshots) ? raw.snapshots : [];
  if (!snapshots.length) return;

  // Chronological order for month-over-month deltas.
  const ordered = [...snapshots].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  for (const p of PLATFORMS) {
    const hasData = ordered.some((s) => typeof s[p.rating] === "number");
    if (!hasData) continue;

    // trustpilot keys off the domain; app stores key off the slug until we learn app ids.
    const externalRef = p.kind === "trustpilot" ? (website ?? id) : id;
    const sourceId = detUuid(`${id}|${p.kind}|${externalRef}|ZZ`);

    acc.sourceRows.push({
      id: sourceId,
      fintechId: id,
      kind: p.kind,
      externalRef,
      country: "ZZ",
      active: p.kind === "trustpilot", // only the wired scraper is active in MVP
    });

    let prevCount: number | null = null;
    for (const s of ordered) {
      const rating = s[p.rating];
      if (typeof rating !== "number") continue;
      const count = typeof s[p.count] === "number" ? s[p.count] : null;
      const delta = count != null && prevCount != null ? count - prevCount : null;
      prevCount = count ?? prevCount;

      acc.snapRows.push({
        sourceId,
        fintechId: id,
        kind: p.kind,
        country: "ZZ",
        snapshotDate: `${s.date}-01`,
        rating: String(rating),
        reviewCount: count,
        reviewCountDelta: delta,
        sentimentPos: s.sentiment?.positive != null ? String(s.sentiment.positive) : null,
        sentimentNeg: s.sentiment?.negative != null ? String(s.sentiment.negative) : null,
      });
    }
  }

  // Homepage source for future offer/price monitoring (inactive in MVP).
  if (website) {
    acc.sourceRows.push({
      id: detUuid(`${id}|homepage|${website}|ZZ`),
      fintechId: id,
      kind: "homepage",
      externalRef: website,
      country: "ZZ",
      active: false,
    });
  }
}

/** app.js lists a handful of entities twice under an underscore-variant slug;
 *  skip the underscore duplicates so the canonical slug is the only record. */
const DUP_SKIP = new Set([
  "atom_bank",
  "hello_bank",
  "hey_banco",
  "illimity_bank",
  "interactive_brokers",
  "jenius_bank",
  "judo_bank",
]);

async function main() {
  console.log("Loading legacy data from", APP_JS);
  const data = loadAppJsData(APP_JS);
  console.log(`  banks=${data.banks.length} exchanges=${data.exchanges.length} news=${data.news.length}`);

  const acc = { fintechRows: [] as FintechRow[], sourceRows: [] as SourceRow[], snapRows: [] as SnapshotRow[] };
  for (const b of data.banks) if (b.id && !DUP_SKIP.has(String(b.id))) buildEntity(b, "neobank", acc);
  for (const e of data.exchanges) if (e.id && !DUP_SKIP.has(String(e.id))) buildEntity(e, "exchange", acc);

  // Dedupe by unique key so no single upsert command touches a row twice.
  acc.fintechRows = dedupeBy(acc.fintechRows, (r) => r.id);
  acc.sourceRows = dedupeBy(acc.sourceRows, (r) => r.id as string);
  acc.snapRows = dedupeBy(acc.snapRows, (r) => `${r.sourceId}|${r.country}|${r.snapshotDate}`);

  console.log(
    `Prepared fintechs=${acc.fintechRows.length} sources=${acc.sourceRows.length} snapshots=${acc.snapRows.length}`,
  );

  // fintechs — upsert (refresh mutable fields).
  for (const c of chunk(acc.fintechRows, 200)) {
    await db
      .insert(fintechs)
      .values(c)
      .onConflictDoUpdate({
        target: fintechs.id,
        set: {
          name: sqlExcluded("name"),
          country: sqlExcluded("country"),
          logoSvg: sqlExcluded("logo_svg"),
          website: sqlExcluded("website"),
          updatedAt: new Date(),
        },
      });
  }
  console.log("  ✓ fintechs upserted");

  // sources — deterministic id, keep existing on conflict.
  for (const c of chunk(acc.sourceRows, 500)) {
    await db.insert(sources).values(c).onConflictDoNothing();
  }
  console.log("  ✓ sources upserted");

  // metric_snapshots — upsert on natural key.
  for (const c of chunk(acc.snapRows, 500)) {
    await db
      .insert(metricSnapshots)
      .values(c)
      .onConflictDoUpdate({
        target: [metricSnapshots.sourceId, metricSnapshots.country, metricSnapshots.snapshotDate],
        set: {
          rating: sqlExcluded("rating"),
          reviewCount: sqlExcluded("review_count"),
          reviewCountDelta: sqlExcluded("review_count_delta"),
          sentimentPos: sqlExcluded("sentiment_pos"),
          sentimentNeg: sqlExcluded("sentiment_neg"),
        },
      });
  }
  console.log("  ✓ metric_snapshots upserted");

  console.log("\nSeed complete.");
}

// Small helper for "SET col = EXCLUDED.col" in Drizzle upserts.
import { sql } from "drizzle-orm";
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
