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
import { FILLS, FOUNDED } from "./verified-facts.ts";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const only = (argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CONC = 5;
if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const FIELDS = ["country", "founded", "headquarters", "employees", "valuationUsd", "status", "ownership", "licenses", "description"] as const;

// Facts we've verified by hand (authoritative) — always trusted, never re-judged.
type Verdicts = Partial<Record<(typeof FIELDS)[number], "high">>;
const VERIFIED: Record<string, Verdicts> = {
  zen: { licenses: "high", country: "high" }, // ZEN.COM: Bank of Lithuania EMI (user-confirmed)
};
// Everything hand-checked against national business + regulator registers is
// declared once in scripts/verified-facts.ts (with its sources) and trusted
// here, so the two can't drift apart.
for (const [id, fill] of Object.entries(FILLS)) {
  const v: Verdicts = (VERIFIED[id] ??= {});
  for (const f of FIELDS) if (f in fill) v[f] = "high";
}
for (const id of Object.keys(FOUNDED)) (VERIFIED[id] ??= {}).founded = "high";

const SYSTEM =
  "You are a strict fact-checker for a fintech / crypto-exchange directory. For each stored field, decide whether " +
  "you are HIGHLY CONFIDENT the specific value is factually correct for THIS company. Output \"high\" only when you " +
  "are sure (a well-known fact, or it matches the official register provided); otherwise \"low\". When unsure, ALWAYS " +
  "say \"low\" — it is far worse to show a wrong fact than to hide a right one. For a crypto exchange, a `licenses`/" +
  "regulator value that contradicts the official MiCA register row must be \"low\".\n" +
  "Separately, flag risky FAQs. FAQs are the company's own product prose and are kept by default; a FAQ is only a " +
  "problem when it asserts an EXTERNAL fact — a regulator/licence/legal-entity, country of authorisation, deposit-" +
  "guarantee/insurance-scheme, listing, or a market statistic — that is WRONG, unverifiable, or contradicts the " +
  "official register. Do NOT flag a FAQ merely for product specifics (prices, coverage amounts, supported coins). " +
  "Return the indices of only the FAQs that must be hidden.\n" +
  "Respond with ONLY JSON: each stored-field name → \"high\"/\"low\", plus \"hideFaqs\": [<indices to hide>] (empty " +
  "array if none / no FAQs).";

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
  const faqs: { q: string; a: string }[] = Array.isArray(r.faqs) ? (r.faqs as any) : [];
  if (present.length || faqs.length) {
    const faqBlock = faqs.length
      ? `\n\nFAQs (judge each answer, in order):\n${faqs.map((f, i) => `[${i}] Q: ${f.q}\n    A: ${f.a}`).join("\n")}`
      : "";
    try {
      const res = await anthropic().messages.create(
        { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 1000, system: SYSTEM,
          messages: [{ role: "user", content:
            `Company: ${r.name} (${r.type})\nWebsite: ${r.website ?? "?"}\n${register}\n\nSTORED VALUES (judge each):\n${JSON.stringify(Object.fromEntries(present.map((f) => [f, (current as any)[f]])))}${faqBlock}` }] },
        { timeout: 90_000, maxRetries: 1 },
      );
      const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const m = t.match(/\{[\s\S]*\}/);
      if (m) out = JSON.parse(m[0]);
    } catch { /* leave all low */ }
  }

  const conf: Record<string, any> = {};
  for (const f of present) conf[f] = out[f] === "high" ? "high" : "low";
  // Per-FAQ gate: keep by default, hide only the indices flagged with a bad
  // external claim. A parse miss (no array) keeps everything — FAQs are the
  // company's own prose, so default-show; the gate targets wrong external facts.
  if (faqs.length) {
    const hide = new Set<number>(Array.isArray(out.hideFaqs) ? out.hideFaqs.map((n: any) => Number(n)) : []);
    conf.faqs = faqs.map((_, i) => (hide.has(i) ? "low" : "high"));
  }
  Object.assign(conf, VERIFIED[r.id] ?? {}); // hand-verified overrides win

  const highs = Object.entries(conf).filter(([k, v]) => v === "high" && k !== "faqs").map(([k]) => k);
  const lows = Object.entries(conf).filter(([k, v]) => v === "low" && k !== "faqs").map(([k]) => k);
  const faqHi = Array.isArray(conf.faqs) ? conf.faqs.filter((v: string) => v === "high").length : 0;
  done++;
  console.log(`${r.id}: high=[${highs.join(",")}] low=[${lows.join(",")}]${faqs.length ? ` faqs=${faqHi}/${faqs.length}` : ""}`);
  if (DRY) return;
  await db.update(schema.fintechs).set({ factConfidence: conf, updatedAt: new Date() }).where(eq(schema.fintechs.id, r.id));
}

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(one));
}
console.log(`\ndone. audited ${done}`);
process.exit(0);
