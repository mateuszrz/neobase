/**
 * Render-time SAMPLE mentions for the public profile preview.
 *
 * Third-party posts ABOUT the brand (not the brand's own). Generated
 * deterministically per fintech — NEVER stored in the DB. The query returns
 * these only when no real (search-ingested) mentions exist yet, and the UI
 * labels them "Sample". Real mentions replace them automatically.
 */

import { rng } from "@/lib/rng";

export type MentionNetwork = "x" | "facebook" | "reddit";

export interface MentionView {
  network: MentionNetwork;
  authorName: string;
  authorHandle: string | null;
  text: string;
  postedAt: string; // ISO
  sentiment: "positive" | "neutral" | "negative";
  url: string | null;
}

const AUTHORS = [
  "Priya Nair", "Tomasz Wójcik", "Marcus Bell", "Elena Fischer", "Sam Okoro",
  "Léa Dubois", "Daniel Kim", "Aisha Rahman", "Chris Whitfield", "Nora Lindqvist",
];

const TEMPLATES: { t: (n: string) => string; s: MentionView["sentiment"] }[] = [
  { t: (n) => `Been using ${n} for 6 months now — the app just works. Transfers land instantly and support actually replies.`, s: "positive" },
  { t: (n) => `Switched to ${n} and honestly not looking back. The fee transparency alone is worth it.`, s: "positive" },
  { t: (n) => `Anyone else having issues with ${n} verification today? Been stuck for hours 😤`, s: "negative" },
  { t: (n) => `${n} raising rates again? Curious how this compares to the competition right now.`, s: "neutral" },
  { t: (n) => `Great thread on how ${n} is rethinking cross-border payments. Worth a read for anyone in fintech.`, s: "positive" },
  { t: (n) => `Mixed feelings on ${n} lately — love the product, but the latest update changed a flow I relied on.`, s: "neutral" },
  { t: (n) => `${n}'s customer service left me hanging on a frozen account. Not a great look.`, s: "negative" },
  { t: (n) => `If you're comparing neobanks in 2026, ${n} keeps coming up in every conversation I have.`, s: "neutral" },
];

const NETS: MentionNetwork[] = ["x", "x", "reddit", "facebook"];

/** Deterministic sample mentions (most recent first) for a fintech. */
export function sampleMentions(fintechId: string, name: string, count = 5): MentionView[] {
  const r = rng(`mentions:${fintechId}`);
  const now = Date.now();
  const day = 86_400_000;
  const out: MentionView[] = [];
  let daysAgo = r.int(0, 3);
  for (let i = 0; i < count; i++) {
    const network = r.pick(NETS);
    const tpl = r.pick(TEMPLATES);
    const author = r.pick(AUTHORS);
    const slug = author.toLowerCase().replace(/[^a-z]/g, "").slice(0, 12);
    const handle = network === "x" ? `@${slug}` : network === "reddit" ? `u/${slug}` : null;
    out.push({
      network,
      authorName: author,
      authorHandle: handle,
      text: tpl.t(name),
      postedAt: new Date(now - daysAgo * day).toISOString(),
      sentiment: tpl.s,
      url: null,
    });
    daysAgo += r.int(1, 5);
  }
  return out;
}
