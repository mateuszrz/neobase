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

function parseItems(result: any): NewsRow[] {
  const items: any[] = result?.items ?? [];
  const out: NewsRow[] = [];
  for (const it of items) {
    if (it?.type && it.type !== "news_search") continue;
    const title = it?.title;
    if (typeof title !== "string" || !title.trim()) continue;
    const ts = it?.timestamp ?? it?.time_published ?? null;
    const posted = ts ? new Date(ts) : null;
    const url: string | null = it?.url ?? null;
    out.push({
      externalId: String(it?.url ?? title),
      url,
      publishedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
      title: title.trim(),
      publisher: it?.source ?? it?.domain ?? null,
      snippet: typeof it?.snippet === "string" ? it.snippet : null,
    });
  }
  return out;
}

/**
 * Fetch + upsert Google News for a brand query in one market.
 * `country` is the ISO2 market (ZZ → a global/default query).
 */
export async function ingestNews(fintechId: string, brandQuery: string, country = "ZZ"): Promise<number> {
  if (!isDataForSeoLive()) throw new Error("DataForSEO credentials not set (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD)");

  const task: Record<string, unknown> = {
    keyword: brandQuery,
    language_code: "en",
    location_name: country === "ZZ" ? "United Kingdom" : undefined,
    location_code: undefined,
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
