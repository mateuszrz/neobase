/**
 * Enrich fintech tags via Claude from a controlled, SEO-aligned vocabulary
 * (tied to the tag taxonomy in lib/tags). Merges assigned tags into
 * fintechs.tags (union — never removes). One batched call per type.
 *
 *   npm run tags:enrich -- neobank
 *   npm run tags:enrich -- exchange
 *   npm run tags:enrich            # both
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const VOCAB: Record<"neobank" | "exchange", Record<string, string>> = {
  neobank: {
    "multi-currency": "holds/spends in multiple currencies",
    travel: "designed for travel / spending abroad",
    "low-fees": "notably low fees",
    "free-atm": "free ATM withdrawals",
    business: "business/company accounts",
    freelancers: "aimed at freelancers / self-employed",
    invoicing: "invoicing tools",
    savings: "savings features",
    "high-yield": "high-yield interest",
    budgeting: "budgeting / money-management tools",
    students: "aimed at students",
    "gen-z": "aimed at Gen-Z / young users",
    credit: "credit or credit-building",
    overdraft: "overdraft facility",
    cashback: "cashback / rewards on spending",
    investments: "investing in stocks/assets",
    "stock-trading": "stock trading",
    crypto: "integrated crypto features",
    transfers: "money transfers",
    p2p: "peer-to-peer payments",
    remittance: "international remittances",
    "non-residents": "can open without local residency (expats)",
    premium: "premium/paid tier with perks",
    "virtual-card": "instant virtual / disposable cards",
    insurance: "bundled travel or purchase insurance",
    teens: "accounts/cards for kids or teenagers",
    "joint-accounts": "shared/joint accounts",
    "apple-pay": "Apple Pay support",
    "google-pay": "Google Pay support",
    "early-salary": "get paid early / earned-wage access",
    "expense-management": "expense-management tools for teams",
    "free-account": "a genuinely free (no monthly fee) account",
  },
  exchange: {
    spot: "spot trading", futures: "futures / perpetuals", derivatives: "derivatives products",
    margin: "margin trading", options: "options trading", staking: "staking",
    earn: "earn / savings products", lending: "crypto lending", nft: "NFT marketplace",
    "copy-trading": "copy / social trading", "low-fees": "notably low trading fees",
    "beginner-friendly": "easy for beginners", defi: "DeFi access", dex: "decentralized exchange / swap",
    "web3-wallet": "integrated self-custody Web3 wallet",
  },
};

const types = (process.argv[2] ? [process.argv[2]] : ["neobank", "exchange"]) as ("neobank" | "exchange")[];

for (const type of types) {
  const vocab = VOCAB[type];
  const allowed = new Set(Object.keys(vocab));
  const rows = await db.select({ id: schema.fintechs.id, name: schema.fintechs.name, tags: schema.fintechs.tags }).from(schema.fintechs).where(eq(schema.fintechs.type, type));

  const SYSTEM =
    `You tag ${type === "exchange" ? "crypto exchanges" : "neobanks / digital banks"} for a comparison directory. ` +
    "For each one, return the tags from the ALLOWED list that genuinely apply to its product today. Use ONLY allowed " +
    "tags. Be accurate but generous where a feature clearly exists — a good directory tags every real product feature " +
    "(e.g. a multi-currency travel card, virtual cards, cashback). Respond with ONLY a JSON object mapping each id to an array of allowed tags.";
  const vocabList = Object.entries(vocab).map(([k, v]) => `- ${k}: ${v}`).join("\n");
  const list = rows.map((r) => `${r.id} — ${r.name}`).join("\n");

  console.log(`\n=== ${type} (${rows.length}) ===`);
  const res = await anthropic().messages.create(
    { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 4000, system: SYSTEM, messages: [{ role: "user", content: `ALLOWED tags:\n${vocabList}\n\n${type}s (id — name):\n${list}\n\nReturn JSON: { "<id>": ["tag", ...], ... }` }] },
    { timeout: 90_000, maxRetries: 1 },
  );
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) { console.log("no JSON:", text.slice(0, 200)); continue; }
  const assigned = JSON.parse(m[0]) as Record<string, string[]>;

  let updated = 0;
  for (const r of rows) {
    const add = (assigned[r.id] ?? []).filter((t) => allowed.has(t));
    if (!add.length) continue;
    const merged = Array.from(new Set([...((r.tags as string[]) ?? []), ...add]));
    await db.update(schema.fintechs).set({ tags: merged }).where(eq(schema.fintechs.id, r.id));
    updated++;
  }
  console.log(`enriched ${updated}/${rows.length}`);
}
process.exit(0);
