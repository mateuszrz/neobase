/**
 * Seed `blog` crawl sources from each fintech's website (website + /blog).
 *
 *   npm run blog:seed
 *
 * Best-effort URL guess — many fintechs use /blog; adjust individual rows later
 * for newsroom/press paths. Public + weekly + global (ZZ). The weekly-public
 * kickoff then crawls them and extracts posts into blog_posts (live only —
 * profiles show the render-time sample until then). Idempotent (natural key).
 */

import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { blogUrlFor } from "../lib/blog/ingest.ts";

const { fintechs, sources } = schema;

const rows = await db.select({ id: fintechs.id, website: fintechs.website }).from(fintechs).where(isNotNull(fintechs.website));

let created = 0;
let skipped = 0;
for (const f of rows) {
  const url = blogUrlFor(f.website);
  if (!url) {
    skipped++;
    continue;
  }
  const inserted = await db
    .insert(sources)
    .values({ fintechId: f.id, kind: "blog", externalRef: url, country: "ZZ", scope: "public", cadence: "weekly", active: true })
    .onConflictDoNothing({ target: [sources.fintechId, sources.kind, sources.externalRef, sources.country] })
    .returning({ id: sources.id });
  inserted.length ? created++ : skipped++;
}

console.log(`blog sources — created ${created}, skipped ${skipped} (of ${rows.length} fintechs with a website)`);
process.exit(0);
