/**
 * Render-time SAMPLE blog posts for the public profile preview. Deterministic per
 * fintech, never stored. Returned only when no real (crawled) posts exist; the UI
 * labels them "Sample". Real posts replace them automatically.
 */

import { rng } from "@/lib/rng";

export interface BlogPostView {
  title: string;
  url: string | null;
  publishedAt: string; // ISO
  snippet: string;
}

const POSTS: { t: (n: string) => string; snip: (n: string) => string }[] = [
  {
    t: (n) => `Inside ${n}: how we think about building for the next million customers`,
    snip: () => `A look at the product principles and engineering bets shaping the roadmap for the year ahead.`,
  },
  {
    t: (n) => `${n} product update: what's new this month`,
    snip: (n) => `A round-up of the latest features and improvements rolling out to ${n} customers.`,
  },
  {
    t: () => `Spending abroad this summer? Here's how to avoid hidden fees`,
    snip: (n) => `Practical tips on getting the best exchange rates and avoiding surprise charges with ${n}.`,
  },
  {
    t: (n) => `${n} partners to expand its payments network`,
    snip: () => `Details on a new partnership and what it means for faster, cheaper transfers.`,
  },
  {
    t: () => `How we keep your money safe: a look under the hood`,
    snip: (n) => `An explainer on the security, licensing and safeguards behind ${n}.`,
  },
];

export function sampleBlogPosts(fintechId: string, name: string, count = 4): BlogPostView[] {
  const r = rng(`blog:${fintechId}`);
  const now = Date.now();
  const day = 86_400_000;
  const picks = [...POSTS].sort(() => r.next() - 0.5).slice(0, count);
  let daysAgo = r.int(2, 6);
  return picks.map((p) => {
    const item: BlogPostView = {
      title: p.t(name),
      url: null,
      publishedAt: new Date(now - daysAgo * day).toISOString(),
      snippet: p.snip(name),
    };
    daysAgo += r.int(5, 18);
    return item;
  });
}
