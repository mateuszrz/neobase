/**
 * Relevance + quality gate for third-party mentions. Brand-name search is noisy —
 * Reddit matches "Revolut" against "revolution", common-word brands (Wise/Curve)
 * pull unrelated chatter, and social surfaces are full of referral/affiliate spam.
 * A batched Haiku call keeps only posts genuinely ABOUT the brand AND substantive
 * (informative/opinion), dropping promotional/referral junk.
 *
 * Fail-open: without ANTHROPIC_API_KEY (or on error) everything passes, so a
 * missing key never silently drops real mentions.
 */

import { anthropic, isClaudeLive } from "@/lib/anthropic";
import { env } from "@/lib/env";

const SYSTEM =
  "You filter social posts for a brand monitor. Return ONLY posts that are BOTH (a) genuinely ABOUT the " +
  "named company — a real opinion, experience, review, complaint, question, discussion, or news about it — " +
  "and (b) substantive/informative.\n" +
  "REJECT (false): coincidental word matches (e.g. 'Revolut' vs 'revolution'), unrelated topics, and " +
  "PROMOTIONAL / SPAM / TRANSACTIONAL posts — referral or invite links ('get £100 using my link', 'my " +
  "referral code'), affiliate or giveaway promos, borrow/lending requests (e.g. 'REQ €40 REPAY €65'), " +
  "for-sale / marketplace / trade listings that merely accept the brand as a payment method, and pure " +
  "self-promotion.\n" +
  "Respond with ONLY a JSON array of booleans, one per numbered post in order: true = keep, false = drop.";

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
