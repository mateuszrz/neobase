/**
 * Apply a generated Drizzle migration SQL file to Neon over the HTTP driver.
 * Used when `drizzle-kit push` can't run (no TTY for its interactive confirm).
 * Additive-only migrations are safe; statements run individually and idempotent
 * `CREATE TABLE`/index failures for already-applied migrations are surfaced.
 *
 *   npm run db:apply -- drizzle/0001_amusing_adam_warlock.sql
 */

import "dotenv/config";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("usage: db:apply -- <path-to-migration.sql>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL!);
const statements = readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

console.log(`Applying ${statements.length} statement(s) from ${file}…`);
for (const [i, stmt] of statements.entries()) {
  try {
    await sql.query(stmt);
    console.log(`  [${i + 1}/${statements.length}] ok`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Already-applied (idempotent) — report but don't abort the run.
    if (/already exists/i.test(msg)) {
      console.log(`  [${i + 1}/${statements.length}] skip (exists)`);
      continue;
    }
    console.error(`  [${i + 1}/${statements.length}] FAILED: ${msg}`);
    process.exit(1);
  }
}
console.log("Done.");
process.exit(0);
