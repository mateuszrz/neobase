/**
 * Per-field trust gate. For every fintech, Claude rates how CONFIDENT it is that
 * each stored factual value is correct — strictly: "high" only when it's sure,
 * "low" otherwise. For exchanges we hand it the authoritative MiCA/CASP register
 * row so `country`/`licenses` can be corroborated against the official source.
 * The profile then renders a hard fact only when it's "high" (see components/
 * Profile.tsx). We never show data we aren't confident is correct.
 *
 *   npm run data:confidence            # all
 *   npm run data:confidence -- --only zen,revolut --dry
 */

import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const only = (argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CONC = 5;
if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const FIELDS = ["country", "founded", "headquarters", "employees", "valuationUsd", "status", "licenses", "description"] as const;

// Facts we've verified by hand (authoritative) — always trusted.
const VERIFIED: Record<string, Partial<Record<(typeof FIELDS)[number], "high">>> = {
  zen: { licenses: "high", country: "high" }, // ZEN.COM: Bank of Lithuania EMI (user-confirmed)
};

const SYSTEM =
  "You are a strict fact-checker for a fintech / crypto-exchange directory. For each stored field, decide whether " +
  "you are HIGHLY CONFIDENT the specific value is factually correct for THIS company. Output \"high\" only when you " +
  "are sure (a well-known fact, or it matches the official register provided); otherwise \"low\". When unsure, ALWAYS " +
  "say \"low\" — it is far worse to show a wrong fact than to hide a right one. For a crypto exchange, a `licenses`/" +
  "regulator value that contradicts the official MiCA register row must be \"low\". Respond with ONLY JSON mapping " +
  "each field name to \"high\" or \"low\".";

// Authoritative register lookup for exchanges.
const casps = await db.select().from(schema.caspProviders);
const caspById = new Map(casps.map((c) => [c.id, c]));

const rowsAll = await db.select().from(schema.fintechs);
let rows = only.length ? rowsAll.filter((r) => only.includes(r.id)) : rowsAll;
console.log(`auditing ${rows.length} fintechs${DRY ? " (dry)" : ""}…\n`);

let done = 0;
async function one(r: (typeof rows)[number]) {
  const current: Record<string, unknown> = {};
  for (const f of FIELDS) current[f] = (r as any)[f];
  const casp = r.caspProviderId ? caspById.get(r.caspProviderId) : null;
  const register = casp
    ? `OFFICIAL MiCA REGISTER (authoritative): regulator=${casp.regulator}, country=${casp.country}, legalEntity=${casp.legalEntity ?? "?"}, services=${(casp.services ?? []).join("; ")}`
    : "No official register row.";

  let out: any = {};
  // A field with no stored value can't be shown anyway — only judge present ones.
  const present = FIELDS.filter((f) => {
    const v = (current as any)[f];
    return v != null && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
  if (present.length) {
    try {
      const res = await anthropic().messages.create(
        { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 700, system: SYSTEM,
          messages: [{ role: "user", content:
            `Company: ${r.name} (${r.type})\nWebsite: ${r.website ?? "?"}\n${register}\n\nSTORED VALUES (judge each):\n${JSON.stringify(Object.fromEntries(present.map((f) => [f, (current as any)[f]])))}` }] },
        { timeout: 90_000, maxRetries: 1 },
      );
      const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const m = t.match(/\{[\s\S]*\}/);
      if (m) out = JSON.parse(m[0]);
    } catch { /* leave all low */ }
  }

  const conf: Record<string, "high" | "low"> = {};
  for (const f of present) conf[f] = out[f] === "high" ? "high" : "low";
  Object.assign(conf, VERIFIED[r.id] ?? {}); // hand-verified overrides win

  const highs = Object.entries(conf).filter(([, v]) => v === "high").map(([k]) => k);
  const lows = Object.entries(conf).filter(([, v]) => v === "low").map(([k]) => k);
  done++;
  console.log(`${r.id}: high=[${highs.join(",")}] low=[${lows.join(",")}]`);
  if (DRY) return;
  await db.update(schema.fintechs).set({ factConfidence: conf, updatedAt: new Date() }).where(eq(schema.fintechs.id, r.id));
}

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(one));
}
console.log(`\ndone. audited ${done}`);
process.exit(0);
