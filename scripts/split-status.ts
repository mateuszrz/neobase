/**
 * One-off backfill for drizzle/0016: splits the old catch-all `status` column
 * into `status` (lifecycle) and `ownership` (who owns the company).
 *
 * The column had accumulated two unrelated vocabularies: every exchange said
 * "active" (a lifecycle fact) while every neobank said "Private", "Unicorn",
 * "Public (NASDAQ: PYPL)" and so on (an ownership fact). One column couldn't
 * express both, so a neobank could never say it was still trading and an
 * exchange could never say who owned it.
 *
 * Idempotent: rows whose `status` isn't one of the legacy ownership strings are
 * left alone, so re-running is safe.
 *
 *   npm run data:split-status
 *   npm run data:split-status -- --dry
 */

import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const DRY = process.argv.slice(2).includes("--dry");

/** legacy status value → { status, ownership }. */
const MAP: Record<string, { status: string | null; ownership: string | null }> = {
  // Straight ownership facts — they move across and `status` goes empty. We do
  // NOT fill in status: "still trading" is a claim nobody verified for these.
  Private: { status: null, ownership: "Private" },
  Public: { status: null, ownership: "Public" },
  public: { status: null, ownership: "Public" }, // case-normalised
  Subsidiary: { status: null, ownership: "Subsidiary" },
  "Private (Paysafe Group)": { status: null, ownership: "Private (Paysafe Group)" },
  "Subsidiary (Commerzbank)": { status: null, ownership: "Subsidiary (Commerzbank)" },
  "Subsidiary (JPMorgan)": { status: null, ownership: "Subsidiary (JPMorgan)" },
  "Public (BIT: ILTY)": { status: null, ownership: "Public (BIT: ILTY)" },
  "Public (LSE: WISE)": { status: null, ownership: "Public (LSE: WISE)" },
  "Public (ASX: JDO)": { status: null, ownership: "Public (ASX: JDO)" },
  "Public (NASDAQ: AFRM)": { status: null, ownership: "Public (NASDAQ: AFRM)" },
  "Public (NASDAQ: IBKR)": { status: null, ownership: "Public (NASDAQ: IBKR)" },
  "Public (NASDAQ: PAYO)": { status: null, ownership: "Public (NASDAQ: PAYO)" },
  "Public (NASDAQ: PYPL)": { status: null, ownership: "Public (NASDAQ: PYPL)" },
  "Public (Block Inc.)": { status: null, ownership: "Subsidiary (Block Inc.)" }, // Cash App is a
  // product of Block, not a listed company itself
  "Part of Allegro (WSE: ALE)": { status: null, ownership: "Subsidiary (Allegro, WSE: ALE)" },

  // These carried BOTH facts in one string — the split is the whole point.
  "Acquired (Block Inc.)": { status: "acquired", ownership: "Subsidiary (Block Inc.)" },
  "Acquired (Zip Co)": { status: "acquired", ownership: "Subsidiary (Zip Co)" },

  // "Unicorn" is a valuation badge, not an ownership structure — but it does
  // imply private ownership, so that part survives and the badge is folded into
  // a parenthetical rather than dropped outright.
  Unicorn: { status: null, ownership: "Private (unicorn)" },
  "Profitable Unicorn": { status: null, ownership: "Private (unicorn)" },
  // "Profitable" is neither lifecycle nor ownership, and it's an unverified
  // financial claim from the 2024 seed. Starling is privately held; the
  // profitability assertion is dropped rather than moved somewhere it'd render.
  Profitable: { status: null, ownership: "Private" },
};

const rows = await db.execute(sql`select id, type, status from fintechs where status is not null`);
let moved = 0;
for (const r of rows.rows as any[]) {
  const m = MAP[r.status as string];
  if (!m) continue; // "active" and anything already split — leave alone
  moved++;
  console.log(`${r.id.padEnd(18)} ${String(r.status).padEnd(28)} → status=${m.status ?? "∅"} ownership=${m.ownership}`);
  if (DRY) continue;
  await db
    .update(schema.fintechs)
    .set({ status: m.status, ownership: m.ownership, updatedAt: new Date() })
    .where(eq(schema.fintechs.id, r.id));
}
console.log(`\ndone. ${moved} rows split${DRY ? " (dry)" : ""}, ${rows.rows.length - moved} left as-is`);
process.exit(0);
