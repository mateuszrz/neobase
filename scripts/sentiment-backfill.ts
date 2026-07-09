/**
 * Backfill the weekly composite sentiment index from historical data.
 *
 *   npm run sentiment:backfill            # all fintechs, last 10 weeks
 *   npm run sentiment:backfill -- revolut 12
 *
 * Idempotent (upsert per fintech+week). After this the weekly-briefs cron keeps
 * the current week fresh.
 */

import "dotenv/config";
import { db, schema } from "../lib/db/index.ts";
import { backfillSentimentIndex } from "../lib/sentiment/index.ts";

const arg = process.argv[2];
const weeks = Number(process.argv[3] ?? 10) || 10;
const ids = arg && arg !== "all" ? [arg] : (await db.select({ id: schema.fintechs.id }).from(schema.fintechs)).map((r) => r.id);

console.log(`Backfilling ${weeks} weeks of sentiment index for ${ids.length} fintech(s)…`);
let withData = 0;
for (const id of ids) {
  const n = await backfillSentimentIndex(id, weeks);
  if (n > 0) withData++;
}
console.log(`done — ${withData}/${ids.length} fintech(s) have index data`);
process.exit(0);
