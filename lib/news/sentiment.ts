/**
 * Derive news sentiment via Claude.
 *
 * DataForSEO leaves `news_items.sentiment` null, so the UI shows headlines as
 * neutral. This classifies a fintech's un-scored items — sentiment TOWARD THE
 * BRAND (positive / neutral / negative) — in one batched Haiku call and writes it
 * back. Called right after news ingest (see the weekly-news cron); the AI brief
 * then reflects real coverage tone. No-ops without ANTHROPIC_API_KEY.
 */

import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";

const { newsItems } = schema;

type Sentiment = "positive" | "neutral" | "negative";

const SYSTEM =
  "You classify fintech/payments news by sentiment TOWARD THE COMPANY named: " +
  "'positive' = good for the brand (growth, launches, funding, awards, partnerships, expansion); " +
  "'negative' = bad for it (outages, fines, regulatory scrutiny, lawsuits, layoffs, complaints, losses); " +
  "'neutral' = routine or mixed. Respond with ONLY a JSON array of these lowercase strings — " +
  "exactly one per numbered headline, in the same order.";

function toSentiment(v: unknown): Sentiment | null {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "positive" || s === "negative" || s === "neutral" ? (s as Sentiment) : null;
}

/** Classify + store sentiment for one fintech's un-scored news. Returns the count written. */
export async function classifyNews(fintechId: string, limit = 20): Promise<number> {
  if (!isClaudeLive()) return 0;

  const items = await db
    .select({ id: newsItems.id, title: newsItems.title, snippet: newsItems.snippet })
    .from(newsItems)
    .where(and(eq(newsItems.fintechId, fintechId), isNull(newsItems.sentiment)))
    .limit(limit);
  if (!items.length) return 0;

  const list = items
    .map((it, i) => `${i + 1}. ${it.title}${it.snippet ? ` — ${it.snippet.slice(0, 160)}` : ""}`)
    .join("\n");

  let labels: unknown[];
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_REPORT_MODEL, max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: list }] },
      { timeout: 20_000, maxRetries: 0 },
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\[[\s\S]*\]/);
    labels = m ? (JSON.parse(m[0]) as unknown[]) : [];
  } catch {
    return 0; // classification failure leaves sentiment null (UI shows neutral)
  }

  let updated = 0;
  for (let i = 0; i < items.length; i++) {
    const s = toSentiment(labels[i]);
    if (!s) continue;
    await db.update(newsItems).set({ sentiment: s }).where(eq(newsItems.id, items[i].id));
    updated++;
  }
  return updated;
}
