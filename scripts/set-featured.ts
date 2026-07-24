/**
 * Set (or clear) a fintech's "editor's pick" flag. Featured brands render above
 * rank 1 with a "Featured" badge (no number) in the homepage sections and the
 * /best/ rankings - see lib/queries listWithLatest / getBestForTag.
 *
 *   npm run featured:set -- <fintech-id> [on|off]     # default: on
 *   npm run featured:set -- zen                        # feature ZEN.COM
 *   npm run featured:set -- zen off                    # un-feature
 *   npm run featured:set -- --list                     # show current featured
 *
 * Redeploy afterwards (empty commit -> main) to re-prerender the affected pages.
 */

import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../lib/db/index.ts";

const args = process.argv.slice(2);

async function listFeatured() {
  const f = await db.execute(sql`SELECT id, name, type FROM fintechs WHERE featured = true ORDER BY type, name`);
  const rows = (f as any).rows ?? f;
  console.log(`featured (${rows.length}):`);
  for (const r of rows as any[]) console.log(`  ${r.id} (${r.type}) - ${r.name}`);
}

async function main() {
  if (args.includes("--list") || args.length === 0) {
    await listFeatured();
    process.exit(0);
  }
  const id = args[0];
  const on = (args[1] ?? "on").toLowerCase() !== "off";
  const chk = await db.execute(sql`SELECT id, name, type FROM fintechs WHERE id = ${id}`);
  const target = ((chk as any).rows ?? chk)[0];
  if (!target) {
    console.error(`no fintech with id "${id}"`);
    process.exit(1);
  }
  await db.execute(sql`UPDATE fintechs SET featured = ${on} WHERE id = ${id}`);
  console.log(`${on ? "featured" : "un-featured"}: ${target.id} (${target.type}) - ${target.name}\n`);
  await listFeatured();
  process.exit(0);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
