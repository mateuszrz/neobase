/**
 * Writes the hand-verified facts in scripts/verified-facts.ts to the directory:
 * the full field set for the four exchanges no crawler can reach, plus founding
 * years for the exchanges that had none. Both are values scripts/refresh-from-
 * about.ts and refresh-from-wikipedia.ts couldn't get — bot-blocked sites, or a
 * year only a national business register states.
 *
 * The same ids are trusted by the confidence gate (see the VERIFIED map in
 * scripts/audit-confidence.ts, which derives from the same module).
 *
 *   npm run data:fill-thin
 *   npm run data:fill-thin -- --dry
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { FILLS, FOUNDED } from "./verified-facts.ts";

const DRY = process.argv.slice(2).includes("--dry");

for (const [id, fill] of Object.entries(FILLS)) {
  console.log(`✎ ${id}: ${Object.keys(fill).join(", ")}`);
  if (DRY) continue;
  await db
    .update(schema.fintechs)
    .set({ ...fill, updatedAt: new Date() } as any)
    .where(eq(schema.fintechs.id, id));
}

for (const [id, founded] of Object.entries(FOUNDED)) {
  console.log(`✎ ${id}: founded=${founded}`);
  if (DRY) continue;
  await db
    .update(schema.fintechs)
    .set({ founded, updatedAt: new Date() })
    .where(eq(schema.fintechs.id, id));
}

const n = Object.keys(FILLS).length + Object.keys(FOUNDED).length;
console.log(`\ndone. ${n} exchanges${DRY ? " (dry)" : " filled"}`);
process.exit(0);
