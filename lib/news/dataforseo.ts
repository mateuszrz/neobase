/**
 * Live news ingest via DataForSEO Google News (SERP API).
 *
 * Runs a brand-query search per market and upserts the results into news_items.
 * Wired but dormant until DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD are set — the
 * public page renders sample news until then. Sentiment is left null here (a
 * later step derives it, e.g. via Claude), so the UI shows it as neutral.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";

const { newsItems } = schema;

const ENDPOINT = "https://api.dataforseo.com/v3/serp/google/news/live/advanced";

export const isDataForSeoLive = () => Boolean(env.DATAFORSEO_LOGIN && env.DATAFORSEO_PASSWORD);

function authHeader(): string {
  const token = Buffer.from(`${env.DATAFORSEO_LOGIN}:${env.DATAFORSEO_PASSWORD}`).toString("base64");
  return `Basic ${token}`;
}

interface NewsRow {
  externalId: string;
  url: string | null;
  publishedAt: Date | null;
  title: string;
  publisher: string | null;
  snippet: string | null;
}

/** DataForSEO timestamps look like "2026-06-14 10:00:00 +00:00" — normalise to ISO. */
function parseTimestamp(ts: unknown): Date | null {
  if (typeof ts !== "string" || !ts.trim()) return null;
  const iso = ts.trim().replace(" ", "T").replace(/\s+\+/, "+").replace(/\s+-(?=\d\d:\d\d$)/, "-");
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowFromItem(it: any): NewsRow | null {
  const title = it?.title;
  if (typeof title !== "string" || !title.trim()) return null;
  const url: string | null = typeof it?.url === "string" ? it.url : null;
  return {
    externalId: String(url ?? title),
    url,
    publishedAt: parseTimestamp(it?.timestamp ?? it?.time_published),
    title: title.trim(),
    publisher: it?.source ?? it?.domain ?? null,
    snippet: typeof it?.snippet === "string" ? it.snippet : null,
  };
}

function parseItems(result: any): NewsRow[] {
  const items: any[] = result?.items ?? [];
  const out: NewsRow[] = [];
  for (const it of items) {
    // `top_stories` carousels nest the real articles under `items[].items[]`.
    if (it?.type === "top_stories" && Array.isArray(it.items)) {
      for (const sub of it.items) {
        const row = rowFromItem(sub);
        if (row) out.push(row);
      }
      continue;
    }
    if (it?.type && it.type !== "news_search") continue;
    const row = rowFromItem(it);
    if (row) out.push(row);
  }
  return out;
}

// Google/DataForSEO location criteria ids. ZZ (global) → US, the highest-volume
// English market. Add per-market codes here when project (per-market) news lands.
const LOCATION_CODE: Record<string, number> = { ZZ: 2840, US: 2840, GB: 2826 };
const locationFor = (country: string): number => LOCATION_CODE[country.toUpperCase()] ?? 2840;

/**
 * Fetch + upsert Google News for a brand query in one market.
 * `country` is the ISO2 market (ZZ → a global/default query).
 */
export async function ingestNews(fintechId: string, brandQuery: string, country = "ZZ"): Promise<number> {
  if (!isDataForSeoLive()) throw new Error("DataForSEO credentials not set (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)");

  const task: Record<string, unknown> = {
    keyword: brandQuery,
    language_code: "en",
    location_code: locationFor(country), // always set — DataForSEO requires a location
  };
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { authorization: authHeader(), "content-type": "application/json" },
    body: JSON.stringify([task]),
  });
  if (!res.ok) throw new Error(`DataForSEO ${res.status}: ${await res.text()}`);
  const json: any = await res.json();
  const result = json?.tasks?.[0]?.result?.[0];
  const rows = parseItems(result);

  let upserted = 0;
  for (const n of rows) {
    await db
      .insert(newsItems)
      .values({
        fintechId,
        country,
        externalId: n.externalId,
        url: n.url,
        publishedAt: n.publishedAt,
        title: n.title,
        publisher: n.publisher,
        snippet: n.snippet,
        sentiment: null,
        raw: n as any,
      })
      .onConflictDoUpdate({
        target: [newsItems.fintechId, newsItems.externalId],
        set: { title: n.title, url: n.url, publisher: n.publisher, snippet: n.snippet, publishedAt: n.publishedAt },
      });
    upserted++;
  }
  return upserted;
}
