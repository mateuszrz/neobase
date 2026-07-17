/**
 * Relevance gate for third-party mentions. Brand-name search is noisy — Reddit
 * matches "Revolut" against "revolution", LinkedIn surfaces tangential hiring
 * posts, common-word brands (Wise/Curve) pull unrelated chatter. A batched Haiku
 * call keeps only posts genuinely ABOUT the brand.
 *
 * Fail-open: without ANTHROPIC_API_KEY (or on error) everything passes, so a
 * missing key never silently drops real mentions.
 */

import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";

const SYSTEM =
  "You filter social posts for a brand monitor. For each numbered post, decide whether it is genuinely " +
  "ABOUT the named company (a mention, review, question, complaint, or news about it) — NOT a coincidental " +
  "word match (e.g. 'Revolut' vs 'revolution'), an unrelated topic, or spam. Respond with ONLY a JSON array " +
  "of booleans, one per post in order: true = about the company, false = not.";

/** Returns a keep-mask aligned to `texts`. All true if Claude is unavailable or errors. */
export async function judgeRelevant(brand: string, texts: string[]): Promise<boolean[]> {
  if (!isClaudeLive() || texts.length === 0) return texts.map(() => true);

  const list = texts.map((t, i) => `${i + 1}. ${t.replace(/\s+/g, " ").slice(0, 240)}`).join("\n");
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_REPORT_MODEL, max_tokens: 500, system: `${SYSTEM}\n\nCompany: ${brand}`, messages: [{ role: "user", content: list }] },
      { timeout: 20_000, maxRetries: 0 },
    );
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = text.match(/\[[\s\S]*\]/);
    const arr = m ? (JSON.parse(m[0]) as unknown[]) : [];
    // Map to booleans; anything not explicitly false is kept (fail-open per item).
    return texts.map((_, i) => arr[i] !== false);
  } catch {
    return texts.map(() => true);
  }
}
