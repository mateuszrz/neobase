/**
 * Seed `social_linkedin` / `social_facebook` sources from each fintech's stored
 * socials handles.
 *
 *   npm run social:seed
 *
 * Public social is global, so sources are created with country ZZ, cadence
 * weekly, scope public — the weekly-public kickoff then fires them (dormant until
 * APIFY_LINKEDIN_ACTOR / APIFY_FACEBOOK_ACTOR are set). Idempotent (natural-key).
 */

import "dotenv/config";
import { db, schema } from "../lib/db/index.ts";
import { handleFrom, kindFor } from "../lib/social/apify.ts";
import type { SocialNetwork } from "../lib/social/sample.ts";

const { fintechs, sources } = schema;
const NETWORKS: SocialNetwork[] = ["linkedin", "facebook"];

const rows = await db.select({ id: fintechs.id, socials: fintechs.socials }).from(fintechs);

let created = 0;
let skipped = 0;
for (const f of rows) {
  for (const net of NETWORKS) {
    const handle = handleFrom(f.socials, net);
    if (!handle) continue;
    const inserted = await db
      .insert(sources)
      .values({ fintechId: f.id, kind: kindFor(net), externalRef: handle, country: "ZZ", scope: "public", cadence: "weekly", active: true })
      .onConflictDoNothing({ target: [sources.fintechId, sources.kind, sources.externalRef, sources.country] })
      .returning({ id: sources.id });
    inserted.length ? created++ : skipped++;
  }
}

console.log(`social sources — created ${created}, skipped ${skipped} (of ${rows.length} fintechs)`);
process.exit(0);
