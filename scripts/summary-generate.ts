/**
 * Generate + store the weekly AI brief for one fintech (or all).
 *
 *   npm run summary:generate -- revolut     # one fintech
 *   npm run summary:generate -- all         # every fintech
 *
 * Uses Claude when ANTHROPIC_API_KEY is set, else the deterministic composer
 * (still grounded in real ratings/sentiment/news). The public page then shows
 * the stored brief instead of the sample preview.
 */

import "dotenv/config";
import { db, schema } from "../lib/db/index.ts";
import { generateSummary } from "../lib/summary/generate.ts";
import { isClaudeLive } from "../lib/anthropic/index.ts";

const arg = process.argv[2] ?? "revolut";
const ids =
  arg === "all"
    ? (await db.select({ id: schema.fintechs.id }).from(schema.fintechs)).map((r) => r.id)
    : [arg];

console.log(`Generating weekly brief for ${ids.length} fintech(s) — ${isClaudeLive() ? "Claude" : "composed (no key)"}`);
for (const id of ids) {
  try {
    const text = await generateSummary(id);
    console.log(`  ${id}: ${text.slice(0, 90)}${text.length > 90 ? "…" : ""}`);
  } catch (err) {
    console.error(`  ${id}: FAILED — ${err instanceof Error ? err.message : String(err)}`);
  }
}
process.exit(0);
