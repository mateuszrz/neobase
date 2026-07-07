/**
 * Render-time SAMPLE social posts for the public profile preview.
 *
 * Generated deterministically per fintech — NEVER stored in the DB, so no fake
 * content is persisted. The query returns these only when no real (Apify-ingested)
 * posts exist yet, and the UI labels them "Sample". Real posts replace them
 * automatically once the live feed runs.
 */

import { rng } from "@/lib/rng";

export type SocialNetwork = "linkedin" | "facebook";

export interface SocialPostView {
  network: SocialNetwork;
  text: string;
  postedAt: string; // ISO
  likes: number;
  comments: number;
  shares: number;
  url: string | null;
}

const TEMPLATES = [
  (n: string) => `Big milestone for the ${n} community — thank you to everyone who's joined us on the journey. More to come. 🚀`,
  (n: string) => `We're hiring across engineering, product and risk. Come build the future of finance with ${n}.`,
  (n: string) => `New in the ${n} app: a faster, cleaner way to manage your money. Update to the latest version to try it.`,
  (n: string) => `Transparency matters. Here's how ${n} keeps your money safe and your fees clear.`,
  (n: string) => `Proud to share that ${n} has been recognised for product innovation this year. This is just the beginning.`,
  (_n: string) => `Travelling this summer? Spend abroad with no hidden fees and real exchange rates.`,
  (n: string) => `Behind every feature is a team obsessed with the details. A look at how ${n} ships.`,
  (_n: string) => `Your feedback shapes what we build next. Tell us what you'd love to see — we're listening.`,
];

/** Deterministic sample feed (most recent first) for a fintech. */
export function sampleSocialPosts(fintechId: string, name: string, count = 4): SocialPostView[] {
  const r = rng(`social:${fintechId}`);
  const now = Date.now();
  const day = 86_400_000;
  const posts: SocialPostView[] = [];
  let daysAgo = r.int(1, 4);
  for (let i = 0; i < count; i++) {
    const network: SocialNetwork = r.next() > 0.45 ? "linkedin" : "facebook";
    const text = r.pick(TEMPLATES)(name);
    const base = r.int(80, 4200);
    posts.push({
      network,
      text,
      postedAt: new Date(now - daysAgo * day).toISOString(),
      likes: base,
      comments: Math.max(1, Math.round(base * (0.02 + r.next() * 0.06))),
      shares: Math.max(0, Math.round(base * (0.01 + r.next() * 0.03))),
      url: null,
    });
    daysAgo += r.int(2, 9);
  }
  return posts;
}
