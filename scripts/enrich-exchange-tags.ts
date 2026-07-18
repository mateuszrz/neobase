/**
 * Enrich crypto-exchange tags via Claude, from a controlled vocabulary aligned
 * to the tag taxonomy (lib/tags). Merges the assigned tags into fintechs.tags
 * (union with existing — never removes). One batched call.
 *
 *   npm run tags:enrich
 */

import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

// Allowed tags (raw) — each maps into a canonical ranking tag in lib/tags.
const VOCAB: Record<string, string> = {
  spot: "spot trading available",
  futures: "futures / perpetuals",
  derivatives: "derivatives products",
  margin: "margin trading",
  options: "options trading",
  staking: "staking",
  earn: "earn / savings products",
  lending: "crypto lending",
  nft: "NFT marketplace",
  "copy-trading": "copy / social trading",
  "low-fees": "notably low trading fees",
  "beginner-friendly": "easy and approachable for beginners",
  defi: "DeFi access / integration",
  dex: "decentralized exchange / token swap",
  "web3-wallet": "integrated self-custody Web3 wallet",
};
const ALLOWED = new Set(Object.keys(VOCAB));

const exch = await db.select({ id: schema.fintechs.id, name: schema.fintechs.name, tags: schema.fintechs.tags }).from(schema.fintechs).where(eq(schema.fintechs.type, "exchange"));

const SYSTEM =
  "You tag crypto exchanges for a comparison directory. For each exchange, return the tags from the ALLOWED list " +
  "that genuinely apply to its product today. Use ONLY allowed tags. Be accurate and conservative — tag a feature " +
  "only if the exchange is known for offering it; do not over-tag. Respond with ONLY a JSON object mapping each " +
  "exchange id to an array of allowed tags.";

const vocabList = Object.entries(VOCAB).map(([k, v]) => `- ${k}: ${v}`).join("\n");
const list = exch.map((e) => `${e.id} — ${e.name}`).join("\n");

const res = await anthropic().messages.create(
  {
    model: env.ANTHROPIC_CRAWL_MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: "user", content: `ALLOWED tags:\n${vocabList}\n\nExchanges (id — name):\n${list}\n\nReturn JSON: { "<id>": ["tag", ...], ... }` }],
  },
  { timeout: 60_000, maxRetries: 1 },
);
const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
const m = text.match(/\{[\s\S]*\}/);
if (!m) { console.log("no JSON in response:", text.slice(0, 200)); process.exit(1); }
const assigned = JSON.parse(m[0]) as Record<string, string[]>;

let updated = 0;
for (const e of exch) {
  const add = (assigned[e.id] ?? []).filter((t) => ALLOWED.has(t));
  if (!add.length) { console.log(`  ${e.id.padEnd(18)} (no tags returned)`); continue; }
  const merged = Array.from(new Set([...((e.tags as string[]) ?? []), ...add]));
  await db.update(schema.fintechs).set({ tags: merged }).where(eq(schema.fintechs.id, e.id));
  updated++;
  console.log(`  ${e.id.padEnd(18)} +[${add.join(", ")}]`);
}
console.log(`\nenriched ${updated}/${exch.length} exchanges`);
process.exit(0);
