/**
 * Populate fintechs.screenshots from the Google Play `details` payload (the same
 * actor the daily rating ingest runs — screenshots ride along for free). Stores
 * up to 6 phone screenshot URLs as { googlePlay: string[] }. Run occasionally;
 * screenshots only change when the app ships a new store listing.
 *
 *   npm run apify:screenshots            # all fintechs with an active GP source
 *   npm run apify:screenshots -- 20      # limit
 */
import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { apify, googlePlayDailyInput } from "../lib/apify/index.ts";
import { env, isApifyLive } from "../lib/env.ts";

const { fintechs, sources } = schema;
const LIMIT = Number(process.argv[2] ?? 100000);
const MAX = 6;

if (!isApifyLive() || !env.APIFY_GOOGLE_PLAY_ACTOR) {
  console.error("APIFY_TOKEN + Google Play actor must be set.");
  process.exit(1);
}

const targets = (await db.execute(sql`
  SELECT f.id, s.external_ref AS ref, f.country AS ft_country
  FROM ${fintechs} f
  JOIN ${sources} s ON s.fintech_id = f.id AND s.kind = 'google_play' AND s.active = true
  ORDER BY f.id
  LIMIT ${LIMIT}
`)).rows as any[];
console.log(`Collecting Google Play screenshots for ${targets.length} fintechs…\n`);

const client = apify();
let ok = 0, none = 0, err = 0;

async function one(t: any): Promise<void> {
  try {
    const store = t.ft_country && String(t.ft_country) !== "ZZ" ? String(t.ft_country) : "us";
    const run = await client.actor(env.APIFY_GOOGLE_PLAY_ACTOR!).call(googlePlayDailyInput(t.ref, store), { waitSecs: 120 });
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 2 });
    const it: any = items[0] ?? {};
    const shots: string[] = Array.isArray(it.screenshots) ? it.screenshots.filter((u: unknown) => typeof u === "string").slice(0, MAX) : [];
    if (!shots.length) { none++; console.log(`  ∅ ${t.id}`); return; }
    await db.update(fintechs).set({ screenshots: { googlePlay: shots } }).where(eq(fintechs.id, t.id));
    ok++;
    console.log(`  ✓ ${t.id.padEnd(16)} ${shots.length} shots`);
  } catch (e) {
    err++;
    console.log(`  ✗ ${t.id.padEnd(16)} ${(e as Error).message.slice(0, 50)}`);
  }
}

for (let i = 0; i < targets.length; i += 8) {
  await Promise.all(targets.slice(i, i + 8).map(one));
  process.stderr.write(`  …${Math.min(i + 8, targets.length)}/${targets.length}\r`);
}
console.log(`\ndone — ${ok} with screenshots, ${none} none, ${err} errors.`);
process.exit(0);
