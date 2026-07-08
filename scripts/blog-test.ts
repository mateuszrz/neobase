/**
 * Live blog ingest for one fintech (needs ANTHROPIC_API_KEY; fetches the blog
 * page free-first, Apify on miss):
 *
 *   npm run blog:test -- revolut
 *   npm run blog:test -- revolut https://www.revolut.com/news/
 *
 * Args: <fintechId> [blogUrl=website+/blog]. Extracts recent posts and upserts
 * into blog_posts; the profile then shows real posts instead of the sample.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { ingestBlogPage, blogUrlFor } from "../lib/blog/ingest.ts";

const fintechId = process.argv[2] ?? "revolut";
let url = process.argv[3];

if (!url) {
  const [ft] = await db.select({ website: schema.fintechs.website }).from(schema.fintechs).where(eq(schema.fintechs.id, fintechId)).limit(1);
  url = blogUrlFor(ft?.website ?? null) ?? "";
}
if (!url) {
  console.error(`no blog URL for "${fintechId}" (no website on file — pass one explicitly)`);
  process.exit(1);
}

const res = await ingestBlogPage(fintechId, url);
console.log(`ingested ${res.upserted} blog post(s) for ${fintechId} (${url}, via ${res.via})`);
process.exit(0);
