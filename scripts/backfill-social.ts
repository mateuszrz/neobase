/**
 * Backfill social posts for every fintech that has a handle for the given
 * network in `fintechs.socials`, synchronously via `ingestSocial`.
 *
 *   npm run social:backfill -- linkedin
 *   npm run social:backfill -- facebook
 *
 * One-off catch-up so the sources seeded by collect-socials get real posts
 * without waiting for the weekly cron. Bounded concurrency (LinkedIn is cheap and
 * fast; Facebook goes through a residential proxy, is slower and pricier, so it
 * runs narrower). Per-brand failures are logged and skipped, never fatal.
 *
 * Facebook note: Meta returns `not_available` for restricted/deleted pages and
 * occasionally a transient SOFT-BLOCK even through residential proxy — the latter
 * is retried once; the former is a genuine empty and left to the sample fallback.
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/index.ts";
import { ingestSocial } from "../lib/social/apify.ts";
import type { SocialNetwork } from "../lib/social/sample.ts";

const argv = process.argv.slice(2);
const network = (argv.find((a) => !a.startsWith("--")) as SocialNetwork) ?? "linkedin";
const force = argv.includes("--force");
if (network !== "linkedin" && network !== "facebook") {
  console.error(`unknown network "${network}" — use linkedin | facebook [--force]`);
  process.exit(1);
}
const CONCURRENCY = network === "facebook" ? 3 : 4;

// Incremental by default: skip brands that already have posts for this network
// (a re-run after adding more socials then only pays for the new brands). --force
// re-ingests everyone.
const rows = (
  await db.execute(sql`
    SELECT f.id FROM fintechs f
    WHERE coalesce(f.socials->>${network},'') <> ''
      ${force ? sql`` : sql`AND NOT EXISTS (SELECT 1 FROM social_posts sp WHERE sp.fintech_id = f.id AND sp.network = ${network})`}
    ORDER BY f.id
  `)
).rows as { id: string }[];

console.log(`backfilling ${network} for ${rows.length} fintech(s)${force ? " (force)" : " (new only)"} (concurrency ${CONCURRENCY})…\n`);

let ok = 0;
let empty = 0;
let failed = 0;
let totalPosts = 0;

const isTransient = (msg: string) => /soft.?block|timeout|429|502|503|ECONNRESET/i.test(msg);

async function run(id: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const n = await ingestSocial(id, network, 12);
      if (n > 0) {
        ok++;
        totalPosts += n;
        console.log(`  ✓ ${id.padEnd(22)} ${n} post(s)`);
      } else {
        empty++;
        console.log(`  · ${id.padEnd(22)} 0 posts (page empty / not_available)`);
      }
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Retry once on a transient block; otherwise give up on this brand.
      if (attempt === 1 && isTransient(msg)) {
        console.log(`  … ${id.padEnd(22)} transient (${msg.slice(0, 40)}) — retrying`);
        continue;
      }
      failed++;
      console.log(`  ✗ ${id.padEnd(22)} ${msg.slice(0, 80)}`);
      return;
    }
  }
}

for (let i = 0; i < rows.length; i += CONCURRENCY) {
  await Promise.all(rows.slice(i, i + CONCURRENCY).map((r) => run(r.id)));
  console.log(`    …${Math.min(i + CONCURRENCY, rows.length)}/${rows.length}`);
}

console.log(
  `\ndone (${network}) — ${ok} brand(s) with posts (${totalPosts} total), ${empty} empty, ${failed} failed.`,
);
process.exit(0);
