/**
 * Curated tag taxonomy. The seed tags are rich but messy (duplicates like
 * budgeting / budgeting-tools, geo mixed with features). This maps the raw tags
 * to a clean canonical set with display labels — used both to normalise the
 * chips shown on a profile and to drive the "Best {X}" ranking pages.
 */

export interface TagDef {
  slug: string; // URL slug for /best/<slug>
  chip: string; // short label for the profile chip
  title: string; // ranking-page H1, e.g. "Best multi-currency accounts"
  blurb: string; // one line under the ranking title
  group: "neobank" | "exchange";
  match: string[]; // raw seed tags that map to this canonical tag
}

/** Canonical, rankable tags. `match` lists the raw tags that qualify. */
export const TAGS: TagDef[] = [
  // ── Neobanks ──
  { slug: "multi-currency-accounts", chip: "Multi-currency", title: "Best multi-currency accounts", blurb: "Neobanks for holding and spending in many currencies.", group: "neobank", match: ["multi-currency"] },
  { slug: "travel-cards", chip: "Travel", title: "Best travel cards", blurb: "Cards for spending abroad with low fees and fair FX.", group: "neobank", match: ["travel", "travelers"] },
  { slug: "low-fee-neobanks", chip: "Low fees", title: "Best low-fee neobanks", blurb: "Accounts with minimal fees and free ATM withdrawals.", group: "neobank", match: ["low-fees", "free-atm"] },
  { slug: "business-accounts", chip: "Business", title: "Best business accounts", blurb: "Neobanks built for companies and SMEs.", group: "neobank", match: ["business", "small-business"] },
  { slug: "for-freelancers", chip: "Freelancers", title: "Best accounts for freelancers", blurb: "Accounts with invoicing and tools for the self-employed.", group: "neobank", match: ["freelancers", "invoicing"] },
  { slug: "savings-accounts", chip: "Savings", title: "Best savings & high-yield accounts", blurb: "Neobanks with strong savings and high-yield rates.", group: "neobank", match: ["savings", "high-yield"] },
  { slug: "budgeting-apps", chip: "Budgeting", title: "Best budgeting apps", blurb: "Neobanks with budgeting and money-management tools.", group: "neobank", match: ["budgeting", "budgeting-tools"] },
  { slug: "for-students", chip: "Students", title: "Best accounts for students", blurb: "Accounts aimed at students and Gen-Z.", group: "neobank", match: ["students", "gen-z"] },
  { slug: "credit-and-lending", chip: "Credit", title: "Best for credit & lending", blurb: "Neobanks offering credit, overdraft or credit-building.", group: "neobank", match: ["credit", "credit-score", "overdraft", "payday-loans"] },
  { slug: "cashback-rewards", chip: "Cashback", title: "Best cashback & rewards accounts", blurb: "Accounts that pay you back on spending.", group: "neobank", match: ["cashback"] },
  { slug: "investing-neobanks", chip: "Investing", title: "Best neobanks for investing", blurb: "Neobanks with built-in stock or asset investing.", group: "neobank", match: ["investments", "stock-trading"] },
  { slug: "crypto-friendly-neobanks", chip: "Crypto", title: "Best crypto-friendly neobanks", blurb: "Neobanks with integrated crypto features.", group: "neobank", match: ["crypto", "nft"] },
  // ── Exchanges ──
  { slug: "spot-trading", chip: "Spot", title: "Best exchanges for spot trading", blurb: "Exchanges strong on spot markets.", group: "exchange", match: ["spot"] },
  { slug: "futures-derivatives", chip: "Derivatives", title: "Best exchanges for futures & derivatives", blurb: "Exchanges offering futures and leveraged products.", group: "exchange", match: ["futures", "derivatives", "margin", "options"] },
  { slug: "staking-earn", chip: "Staking", title: "Best exchanges for staking & earn", blurb: "Exchanges with staking and yield products.", group: "exchange", match: ["staking", "earn", "high-yield", "smart-yield", "lending"] },
  { slug: "nft-platforms", chip: "NFTs", title: "Best exchanges for NFTs", blurb: "Exchanges with NFT marketplaces.", group: "exchange", match: ["nft"] },
  { slug: "copy-trading", chip: "Copy trading", title: "Best exchanges for copy trading", blurb: "Exchanges with social/copy-trading features.", group: "exchange", match: ["copy-trading"] },
];

const BY_SLUG = new Map(TAGS.map((t) => [t.slug, t]));
export const tagBySlug = (slug: string): TagDef | undefined => BY_SLUG.get(slug);
export const tagsForGroup = (group: "neobank" | "exchange"): TagDef[] => TAGS.filter((t) => t.group === group);

/** Raw seed tag → the canonical tags it belongs to (a raw tag can map to several). */
const RAW_TO_CANON = new Map<string, TagDef[]>();
for (const t of TAGS) for (const raw of t.match) {
  const arr = RAW_TO_CANON.get(raw) ?? [];
  arr.push(t);
  RAW_TO_CANON.set(raw, arr);
}

/** Normalise a fintech's raw tags to the canonical chips for its type (deduped, ordered). */
export function normalizeTags(rawTags: string[] | null | undefined, group: "neobank" | "exchange"): { slug: string; chip: string }[] {
  const seen = new Set<string>();
  const out: { slug: string; chip: string }[] = [];
  for (const raw of rawTags ?? []) {
    for (const t of RAW_TO_CANON.get(raw) ?? []) {
      if (t.group !== group || seen.has(t.slug)) continue;
      seen.add(t.slug);
      out.push({ slug: t.slug, chip: t.chip });
    }
  }
  return out;
}
