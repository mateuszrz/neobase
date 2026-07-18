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
  { slug: "crypto-friendly-neobanks", chip: "Crypto", title: "Best crypto-friendly neobanks", blurb: "Neobanks with integrated crypto features.", group: "neobank", match: ["crypto", "crypto-trading", "nft"] },
  { slug: "money-transfer-apps", chip: "Transfers", title: "Best apps for international money transfers", blurb: "Send money abroad with low fees and fair exchange rates.", group: "neobank", match: ["transfers", "p2p", "remittance", "international-transfers"] },
  { slug: "virtual-cards", chip: "Virtual cards", title: "Best virtual card providers", blurb: "Neobanks offering instant virtual and disposable cards.", group: "neobank", match: ["virtual-card", "virtual-cards", "disposable-cards"] },
  { slug: "for-non-residents", chip: "Non-residents", title: "Best bank accounts for non-residents & expats", blurb: "Open an account without local residency.", group: "neobank", match: ["non-residents", "expats"] },
  { slug: "premium-accounts", chip: "Premium", title: "Best premium bank accounts", blurb: "Premium tiers with perks, lounges and higher limits.", group: "neobank", match: ["premium"] },
  { slug: "free-accounts", chip: "Free account", title: "Best free bank accounts", blurb: "Accounts with no monthly fee.", group: "neobank", match: ["free", "free-account", "no-monthly-fee", "no-fees"] },
  { slug: "accounts-with-insurance", chip: "Insurance", title: "Best accounts with travel insurance", blurb: "Cards that bundle travel or purchase insurance.", group: "neobank", match: ["insurance", "travel-insurance"] },
  { slug: "for-teens", chip: "Teens", title: "Best bank accounts for teenagers", blurb: "Accounts and cards for kids and teens.", group: "neobank", match: ["teens", "teenagers", "kids", "family", "junior"] },
  { slug: "joint-accounts", chip: "Joint accounts", title: "Best joint bank accounts", blurb: "Shared accounts for couples and households.", group: "neobank", match: ["joint-accounts", "joint", "shared-accounts"] },
  { slug: "get-paid-early", chip: "Early pay", title: "Best apps to get paid early", blurb: "Access your salary a day or two ahead.", group: "neobank", match: ["early-salary", "get-paid-early", "salary-advance", "earned-wage-access"] },
  { slug: "expense-management", chip: "Expenses", title: "Best expense-management accounts", blurb: "Neobanks with expense tools for teams and the self-employed.", group: "neobank", match: ["expense-management", "expenses", "spend-management"] },
  { slug: "apple-google-pay", chip: "Apple/Google Pay", title: "Best neobanks for Apple Pay & Google Pay", blurb: "Accounts with mobile-wallet support.", group: "neobank", match: ["apple-pay", "google-pay"] },
  // ── Exchanges ──
  { slug: "spot-trading", chip: "Spot", title: "Best exchanges for spot trading", blurb: "Exchanges strong on spot markets.", group: "exchange", match: ["spot"] },
  { slug: "futures-derivatives", chip: "Derivatives", title: "Best exchanges for futures & derivatives", blurb: "Exchanges offering futures and leveraged products.", group: "exchange", match: ["futures", "derivatives", "margin", "options"] },
  { slug: "staking-earn", chip: "Staking", title: "Best exchanges for staking & earn", blurb: "Exchanges with staking and yield products.", group: "exchange", match: ["staking", "earn", "high-yield", "smart-yield", "lending"] },
  { slug: "nft-platforms", chip: "NFTs", title: "Best exchanges for NFTs", blurb: "Exchanges with NFT marketplaces.", group: "exchange", match: ["nft"] },
  { slug: "copy-trading", chip: "Copy trading", title: "Best exchanges for copy trading", blurb: "Exchanges with social/copy-trading features.", group: "exchange", match: ["copy-trading"] },
  { slug: "low-fee-exchanges", chip: "Low fees", title: "Best low-fee crypto exchanges", blurb: "Exchanges with the lowest trading fees.", group: "exchange", match: ["low-fees", "no-fees"] },
  { slug: "for-beginners", chip: "Beginners", title: "Best crypto exchanges for beginners", blurb: "Easy, approachable exchanges for first-time users.", group: "exchange", match: ["beginner-friendly", "beginners"] },
  { slug: "defi-web3", chip: "DeFi & Web3", title: "Best exchanges for DeFi & Web3", blurb: "Exchanges with DeFi access and Web3 wallets.", group: "exchange", match: ["defi", "dex", "web3-wallet"] },
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
