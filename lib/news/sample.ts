/**
 * Render-time SAMPLE news for the public profile preview. Deterministic per
 * fintech, never stored. Returned only when no real (DataForSEO-ingested) items
 * exist; the UI labels them "Sample". Real coverage replaces them automatically.
 */

import { rng } from "@/lib/rng";

export type NewsSentiment = "positive" | "neutral" | "negative";

export interface NewsItemView {
  title: string;
  publisher: string;
  domain: string | null; // for the publisher favicon
  publishedAt: string; // ISO
  snippet: string;
  sentiment: NewsSentiment;
  url: string | null;
}

const PUBLISHERS: { name: string; domain: string }[] = [
  { name: "TechCrunch", domain: "techcrunch.com" },
  { name: "Reuters", domain: "reuters.com" },
  { name: "Financial Times", domain: "ft.com" },
  { name: "Bloomberg", domain: "bloomberg.com" },
  { name: "Sifted", domain: "sifted.eu" },
  { name: "The Verge", domain: "theverge.com" },
  { name: "Finextra", domain: "finextra.com" },
];

const STORIES: { t: (n: string) => string; s: NewsSentiment; snip: (n: string) => string }[] = [
  {
    t: (n) => `${n} reports strong customer growth as revenue climbs`,
    s: "positive",
    snip: (n) => `${n} said active customers rose sharply over the past year, with the company pointing to new markets and product launches as key drivers.`,
  },
  {
    t: (n) => `${n} expands into new markets with local licences`,
    s: "positive",
    snip: (n) => `The fintech confirmed it has secured regulatory approval to operate in additional countries, deepening its European and global footprint.`,
  },
  {
    t: (n) => `${n} launches new premium plan and rewards`,
    s: "neutral",
    snip: (n) => `${n} unveiled an updated subscription tier, adding perks aimed at frequent travellers and higher-balance customers.`,
  },
  {
    t: (n) => `Regulators scrutinise ${n} over compliance controls`,
    s: "negative",
    snip: (n) => `Authorities are reviewing ${n}'s anti-fraud and onboarding processes, part of broader oversight of fast-growing digital banks.`,
  },
  {
    t: (n) => `${n} outage briefly disrupts payments for some users`,
    s: "negative",
    snip: (n) => `A short-lived technical issue affected a subset of ${n} customers; the company said service was restored and funds were unaffected.`,
  },
  {
    t: (n) => `${n} partners on new payments feature`,
    s: "neutral",
    snip: (n) => `${n} announced a partnership to broaden its payments capabilities, as competition among neobanks intensifies.`,
  },
];

export function sampleNews(fintechId: string, name: string, count = 5): NewsItemView[] {
  const r = rng(`news:${fintechId}`);
  const now = Date.now();
  const day = 86_400_000;
  const picks = [...STORIES].sort(() => r.next() - 0.5).slice(0, count);
  let daysAgo = r.int(1, 3);
  return picks.map((story) => {
    const pub = r.pick(PUBLISHERS);
    const item: NewsItemView = {
      title: story.t(name),
      publisher: pub.name,
      domain: pub.domain,
      publishedAt: new Date(now - daysAgo * day).toISOString(),
      snippet: story.snip(name),
      sentiment: story.s,
      url: null,
    };
    daysAgo += r.int(2, 12);
    return item;
  });
}
