/**
 * Derive mention sentiment via Claude — sentiment TOWARD THE BRAND for each
 * un-scored mention, in one batched Haiku call. Mirrors lib/news/sentiment.
 * No-ops without ANTHROPIC_API_KEY (rows stay null → UI shows neutral).
 */

import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";

const { mentions } = schema;

type Sentiment = "positive" | "neutral" | "negative";

const SYSTEM =
  "You classify social-media mentions by sentiment TOWARD THE COMPANY named: " +
  "'positive' = praises or endorses it (good experience, recommendation, positive news); " +
  "'negative' = criticises it (complaint, outage, bad experience, warning); " +
  "'neutral' = a factual mention, question or mixed. Respond with ONLY a JSON array of these " +
  "lowercase strings — exactly one per numbered mention, in the same order.";

function toSentiment(v: unknown): Sentiment | null {
  const s = String(v ?? "").toLowerCase().trim();
  return s === "positive" || s === "negative" || s === "neutral" ? (s as Sentiment) : null;
}

/** Classify + store sentiment for one fintech's un-scored mentions. Returns the count written. */
export async function classifyMentions(fintechId: string, limit = 30): Promise<number> {
  if (!isClaudeLive()) return 0;

  const items = await db
    .select({ id: mentions.id, text: mentions.text })
    .from(mentions)
    .where(and(eq(mentions.fintechId, fintechId), isNull(mentions.sentiment)))
    .limit(limit);
  if (!items.length) return 0;

  const list = items.map((it, i) => `${i + 1}. ${(it.text ?? "").slice(0, 200)}`).join("\n");

  let labels: unknown[];
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_REPORT_MODEL, max_tokens: 700, system: SYSTEM, messages: [{ role: "user", content: list }] },
      { timeout: 20_000, maxRetries: 0 },
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\[[\s\S]*\]/);
    labels = m ? (JSON.parse(m[0]) as unknown[]) : [];
  } catch {
    return 0;
  }

  let updated = 0;
  for (let i = 0; i < items.length; i++) {
    const s = toSentiment(labels[i]);
    if (!s) continue;
    await db.update(mentions).set({ sentiment: s }).where(eq(mentions.id, items[i].id));
    updated++;
  }
  return updated;
}
