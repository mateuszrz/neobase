/**
 * One-off backfill of real social posts + news for every tracked fintech that
 * has a social handle, so profiles show live data before the first weekly cron.
 *
 *   npm run backfill:socialnews          # all fintechs with a LinkedIn/Facebook handle
 *
 * Per fintech: ingest LinkedIn + Facebook posts (whichever handle exists) and
 * Google News, then derive news sentiment. Failures per step are logged and
 * skipped (e.g. Facebook pages that return not_available) — the run continues.
 * Uses the synchronous ingest path with a small worker pool; the weekly crons
 * use the async webhook path instead.
 */

import "dotenv/config";
import { isNotNull } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { handleFrom, ingestSocial } from "../lib/social/apify.ts";
import { ingestNews, isDataForSeoLive } from "../lib/news/dataforseo.ts";
import { classifyNews } from "../lib/news/sentiment.ts";

const CONCURRENCY = 4;

type Row = { id: string; name: string; socials: unknown };

const rows: Row[] = await db
  .select({ id: schema.fintechs.id, name: schema.fintechs.name, socials: schema.fintechs.socials })
  .from(schema.fintechs)
  .where(isNotNull(schema.fintechs.socials));

const targets = rows.filter((r) => handleFrom(r.socials, "linkedin") || handleFrom(r.socials, "facebook"));
console.log(`backfilling ${targets.length} fintechs (concurrency ${CONCURRENCY}); news live: ${isDataForSeoLive()}\n`);

let done = 0;
const totals = { linkedin: 0, facebook: 0, news: 0, sentiment: 0, errors: 0 };

async function one(r: Row) {
  const parts: string[] = [];
  for (const net of ["linkedin", "facebook"] as const) {
    if (!handleFrom(r.socials, net)) continue;
    try {
      const n = await ingestSocial(r.id, net);
      totals[net] += n;
      parts.push(`${net}:${n}`);
    } catch (e: any) {
      totals.errors++;
      parts.push(`${net}:ERR(${String(e?.message ?? e).slice(0, 40)})`);
    }
  }
  if (isDataForSeoLive()) {
    try {
      const n = await ingestNews(r.id, r.name, "ZZ");
      totals.news += n;
      const s = await classifyNews(r.id);
      totals.sentiment += s;
      parts.push(`news:${n}(sent:${s})`);
    } catch (e: any) {
      totals.errors++;
      parts.push(`news:ERR(${String(e?.message ?? e).slice(0, 40)})`);
    }
  }
  done++;
  console.log(`[${String(done).padStart(2)}/${targets.length}] ${r.id.padEnd(14)} ${parts.join("  ")}`);
}

// Simple worker pool.
const queue = [...targets];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (;;) {
      const r = queue.shift();
      if (!r) break;
      await one(r);
    }
  }),
);

console.log(`\nDONE. linkedin:${totals.linkedin} facebook:${totals.facebook} news:${totals.news} sentiment:${totals.sentiment} errors:${totals.errors}`);
process.exit(0);
