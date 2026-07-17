/**
 * Live news ingest for one fintech (requires DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD):
 *
 *   npm run news:test -- revolut Revolut GB
 *
 * Args: <fintechId> [brandQuery=name] [country=ZZ]. Fetches Google News via
 * DataForSEO and upserts into news_items; the profile then shows real coverage.
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { ingestNews, newsKeyword } from "../lib/news/dataforseo.ts";

const fintechId = process.argv[2] ?? "revolut";
let brandQuery = process.argv[3];
const country = process.argv[4] ?? "ZZ";

if (!brandQuery) {
  const [ft] = await db.select({ name: schema.fintechs.name, type: schema.fintechs.type }).from(schema.fintechs).where(eq(schema.fintechs.id, fintechId)).limit(1);
  brandQuery = ft ? newsKeyword(fintechId, ft.name, ft.type) : fintechId;
}

const n = await ingestNews(fintechId, brandQuery, country);
console.log(`ingested ${n} news item(s) for ${fintechId} ("${brandQuery}", ${country})`);
process.exit(0);
