/**
 * Backfill LinkedIn posts for every fintech that has a linkedin handle in
 * `fintechs.socials`, synchronously via `ingestSocial` (the proven social:test
 * path). One-off catch-up so the weekly cron isn't the first thing to populate
 * the 113 sources seeded from collect-socials.
 *
 *   npm run social:backfill-linkedin
 *
 * Bounded concurrency (4) to stay under Apify's concurrent-run limit and pace
 * cost. Per-brand failures (dead page, "No valid target", empty) are logged and
 * skipped, never fatal.
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { ingestSocial } from "../lib/social/apify.ts";

const rows = (
  await db.execute(
    sql`SELECT id FROM fintechs WHERE coalesce(socials->>'linkedin','') <> '' ORDER BY id`,
  )
).rows as { id: string }[];

console.log(`backfilling LinkedIn for ${rows.length} fintech(s)…\n`);

const CONCURRENCY = 4;
let ok = 0;
let empty = 0;
let failed = 0;
let totalPosts = 0;

async function run(id: string): Promise<void> {
  try {
    const n = await ingestSocial(id, "linkedin", 12);
    if (n > 0) {
      ok++;
      totalPosts += n;
      console.log(`  ✓ ${id.padEnd(22)} ${n} post(s)`);
    } else {
      empty++;
      console.log(`  · ${id.padEnd(22)} 0 posts (page empty)`);
    }
  } catch (e) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`  ✗ ${id.padEnd(22)} ${msg.slice(0, 80)}`);
  }
}

for (let i = 0; i < rows.length; i += CONCURRENCY) {
  await Promise.all(rows.slice(i, i + CONCURRENCY).map((r) => run(r.id)));
  console.log(`    …${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`);
}

console.log(
  `\ndone — ${ok} brand(s) with posts (${totalPosts} total), ${empty} empty, ${failed} failed.`,
);
process.exit(0);
