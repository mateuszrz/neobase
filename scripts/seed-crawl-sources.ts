/**
 * Seed `homepage` crawl sources from each fintech's website.
 *
 *   npm run crawl:seed
 *
 * Public crawl is global, so sources are created with country ZZ. Pricing/offer/
 * blog URLs aren't auto-discoverable yet — add those with a dedicated script or
 * manually as the crawl engine matures. Idempotent (sources natural-key upsert).
 */

import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const { fintechs, sources } = schema;

/** Ensure a URL carries a scheme so fetch()/Apify accept it. */
function normalizeUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s.replace(/^\/+/, "")}`;
}

const rows = await db
  .select({ id: fintechs.id, website: fintechs.website })
  .from(fintechs)
  .where(isNotNull(fintechs.website));

let created = 0;
let skipped = 0;

for (const f of rows) {
  const url = f.website ? normalizeUrl(f.website) : null;
  if (!url) {
    skipped++;
    continue;
  }
  const inserted = await db
    .insert(sources)
    .values({
      fintechId: f.id,
      kind: "homepage",
      externalRef: url,
      country: "ZZ",
      active: true,
    })
    .onConflictDoNothing({
      target: [sources.fintechId, sources.kind, sources.externalRef, sources.country],
    })
    .returning({ id: sources.id });
  if (inserted.length) created++;
  else skipped++;
}

console.log(`homepage sources — created ${created}, skipped ${skipped} (of ${rows.length} fintechs with a website)`);
process.exit(0);
