/**
 * Publish (or unpublish) editorial articles by slug, then purge their caches.
 *
 * Writing straight to the database is the fast path for seeding a translated
 * set — but it skips everything the editor does around the write. The public
 * blog routes and the sitemap are ISR (`revalidate = 3600`), so a post
 * published this way stayed invisible on the index for up to an hour; the only
 * lever was pushing an empty commit to force a redeploy. This script closes
 * that gap by calling /api/revalidate once the rows are updated.
 *
 *   npm run blog:publish -- --slug a,b,c
 *   npm run blog:publish -- --slug a --unpublish
 *   npm run blog:publish -- --slug a --dry
 *   npm run blog:publish -- --slug a --base https://www.neobase.co
 *
 * `--base` defaults to APP_BASE_URL. Point it at production when you have
 * written to the production database from a local checkout, which is the usual
 * case here — otherwise you purge a cache nobody is reading.
 */

import "dotenv/config";
import { inArray, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { env } from "../lib/env.ts";

const argv = process.argv.slice(2);
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] ?? "" : "");
const DRY = argv.includes("--dry");
const UNPUBLISH = argv.includes("--unpublish");
const BASE = (arg("--base") || env.APP_BASE_URL).replace(/\/$/, "");
const slugs = arg("--slug").split(",").map((s) => s.trim()).filter(Boolean);

if (slugs.length === 0) {
  console.log("usage: blog:publish -- --slug a,b,c [--unpublish] [--dry] [--base URL]");
  process.exit(1);
}

const found = await db
  .select({ id: schema.articles.id, locale: schema.articles.locale, slug: schema.articles.slug,
            title: schema.articles.title, status: schema.articles.status })
  .from(schema.articles)
  .where(inArray(schema.articles.slug, slugs));

// A typo in a slug would otherwise look like a successful run that published
// nothing, so name the misses explicitly.
const missing = slugs.filter((s) => !found.some((r) => r.slug === s));
if (missing.length) console.log(`! no article for: ${missing.join(", ")}`);
if (found.length === 0) { console.log("nothing to do."); process.exit(1); }

const status = UNPUBLISH ? "draft" : "published";
for (const r of found) console.log(`${r.status} → ${status}  [${r.locale}] ${r.slug}  — ${r.title}`);

if (DRY) { console.log("\ndry run — nothing written."); process.exit(0); }

const now = new Date();
await db
  .update(schema.articles)
  // publishedAt is the FIRST-published date, so re-running this on an already
  // published post must not bump it — `coalesce` keeps the original and only
  // fills the column when it is still empty. Unpublishing leaves it alone too,
  // so re-publishing later restores the real date rather than today's.
  .set(
    UNPUBLISH
      ? { status, updatedAt: now }
      : { status, publishedAt: sql`coalesce(${schema.articles.publishedAt}, ${now})`, updatedAt: now },
  )
  .where(inArray(schema.articles.id, found.map((r) => r.id)));
console.log(`\n${found.length} row(s) updated.`);

// ── purge the ISR caches ──
// Trailing slash on purpose: next.config sets `trailingSlash: true`, so the
// bare path answers with a 308 and the POST only survives because fetch
// re-sends it. Hitting the canonical URL skips that round trip.
const res = await fetch(`${BASE}/api/revalidate/`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${env.CRON_SECRET}` },
  body: JSON.stringify({ items: found.map((r) => ({ locale: r.locale, slug: r.slug })) }),
}).catch((e) => { console.log(`! revalidate call failed: ${String(e).slice(0, 120)}`); return null; });

if (!res) {
  console.log(`  the rows are updated; ${BASE} will catch up within the hour.`);
} else if (!res.ok) {
  console.log(`! revalidate returned ${res.status}: ${(await res.text()).slice(0, 200)}`);
  console.log(`  the rows are updated; ${BASE} will catch up within the hour.`);
} else {
  const json = (await res.json()) as { purged?: string[] };
  console.log(`purged on ${BASE}: ${(json.purged ?? []).join(", ")}`);
}

process.exit(0);
