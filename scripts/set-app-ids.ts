/**
 * Backfill real store app IDs onto the seeded google_play / app_store sources and
 * activate them for live scraping. The seed creates these sources keyed off the
 * fintech slug (a placeholder); here we point them at the real Google Play
 * package / App Store numeric id and flip `active=true`.
 *
 *   npm run apify:ids
 *
 * Idempotent: updates in place by (fintech, kind), preserving the source row (and
 * its seeded history). Inserts a fresh source only if none exists yet.
 */

import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const { sources } = schema;

// Verified 2026-07-06 from the live store listings.
const APP_IDS: Record<string, { google_play: string; app_store: string }> = {
  revolut: { google_play: "com.revolut.revolut", app_store: "932493382" },
  monzo: { google_play: "co.uk.getmondo", app_store: "1052238659" },
  n26: { google_play: "de.number26.android", app_store: "956857223" },
  wise: { google_play: "com.transferwise.android", app_store: "612261027" },
  chime: { google_play: "com.onedebit.chime", app_store: "836215269" },
  bunq: { google_play: "com.bunq.android", app_store: "1021178150" },
};

for (const [slug, ids] of Object.entries(APP_IDS)) {
  for (const kind of ["google_play", "app_store"] as const) {
    const appId = ids[kind];
    const updated = await db
      .update(sources)
      .set({ externalRef: appId, active: true })
      .where(and(eq(sources.fintechId, slug), eq(sources.kind, kind), eq(sources.country, "ZZ")))
      .returning({ id: sources.id });

    if (updated.length) {
      console.log(`  updated  ${slug.padEnd(8)} ${kind.padEnd(12)} = ${appId}`);
    } else {
      await db.insert(sources).values({ fintechId: slug, kind, externalRef: appId, country: "ZZ", active: true });
      console.log(`  inserted ${slug.padEnd(8)} ${kind.padEnd(12)} = ${appId}`);
    }
  }
}

console.log("done");
process.exit(0);
