/**
 * Translate directory prose into a target locale.
 *
 * English stays canonical in `fintechs` and is never written here — translations
 * land in `fintech_translations`, so a bad run can be deleted without touching
 * the source of truth.
 *
 * Two rules keep this honest:
 *
 *  1. We only translate fields the trust gate already cleared as "high".
 *     Hidden text is hidden in every language, so translating it would burn
 *     tokens on something no reader can see.
 *
 *  2. A mechanical guard runs before every write. Translated facts INHERIT the
 *     English confidence verdict, which means nothing re-checks them — so the
 *     one failure mode inheritance can't catch is a translation that changes a
 *     number, a year or a regulator name. The guard is plain string matching,
 *     not another LLM call: numbers and regulator tokens must survive intact or
 *     the field is skipped and logged.
 *
 *   npm run data:translate -- --locale pl
 *   npm run data:translate -- --locale pl --only revolut,kraken --dry
 */

import "dotenv/config";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const arg = (name: string) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : "");
const LOCALE = arg("--locale");
const only = arg("--only").split(",").map((s) => s.trim()).filter(Boolean);
const CONC = 4;

const LANGUAGE: Record<string, string> = { pl: "Polish", de: "German", es: "Spanish", fr: "French" };

if (!LOCALE || !LANGUAGE[LOCALE]) {
  console.log(`usage: data:translate -- --locale <${Object.keys(LANGUAGE).join("|")}> [--only a,b] [--dry]`);
  process.exit(1);
}
if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const SYSTEM =
  `You translate fintech directory copy from English into ${LANGUAGE[LOCALE]}.\n` +
  "This is factual reference content on a regulated-finance site, so translation fidelity matters more than style:\n" +
  "- NEVER change a number, year, percentage, amount or date.\n" +
  "- NEVER translate or localise a proper noun: company names, legal entity forms (B.V., SAS, s.r.o., GmbH), " +
  "regulator names and their abbreviations (BaFin, AMF, AFM, MFSA, CySEC, KNF, CNB), and product names stay verbatim.\n" +
  "- Keep licence identifiers, ISO codes and ticker symbols exactly as written.\n" +
  "- Do not add facts, hedges or marketing language that isn't in the source. Do not omit any claim.\n" +
  "- Use natural, professional prose a native speaker would write — not word-for-word calque.\n" +
  "Respond with ONLY a JSON object using the same keys you were given.";

/**
 * Facts that must survive translation unchanged.
 *
 * Digits catch years, counts, amounts and licence numbers. The regulator list
 * catches the case that matters most on this site: a translated sentence that
 * attributes a licence to the wrong authority.
 */
const REGULATORS = ["BaFin", "AMF", "AFM", "MFSA", "CySEC", "CNMV", "CBI", "CSSF", "FSC", "CNB", "KNF", "FMA",
  "Finanstilsynet", "HANFA", "NBS", "Latvijas Banka", "CONSOB", "MiCA", "MiCAR", "PSAN", "VASP", "CASP", "EMI"];

/**
 * Digits only, separators removed — because a correct Polish or German
 * translation legitimately reformats numbers: "1,000" becomes "1 000", "4.5"
 * becomes "4,5". Comparing raw strings would flag every one of those as a lost
 * fact. Normalising to the digit sequence keeps the check on what matters:
 * whether the same figure is still there.
 */
function normNum(n: string): string {
  return n.replace(/[^\d]/g, "");
}

function factsIn(text: string): string[] {
  const nums = text.match(/\d[\d.,  ]*\d|\d/g) ?? [];
  const regs = REGULATORS.filter((r) => new RegExp(`\\b${r}\\b`).test(text));
  return [...nums.map(normNum).filter(Boolean), ...regs];
}

/** Returns the facts present in `src` but missing from `out`. */
function lostFacts(src: string, out: string): string[] {
  const have = factsIn(out);
  return factsIn(src).filter((f) => !have.includes(f));
}

const rowsAll = await db.execute(sql`
  select id, name, type, description, about, faqs, fact_confidence as "factConfidence"
  from fintechs order by id`);
let rows = rowsAll.rows as any[];
if (only.length) rows = rows.filter((r) => only.includes(r.id));
console.log(`translating ${rows.length} entries → ${LANGUAGE[LOCALE]}${DRY ? " (dry)" : ""}…\n`);

let done = 0, skipped = 0, guarded = 0;

async function one(r: any) {
  const conf = (r.factConfidence ?? {}) as Record<string, unknown>;
  const faqConf: string[] = Array.isArray(conf.faqs) ? (conf.faqs as string[]) : [];
  const srcFaqs: { q: string; a: string }[] = Array.isArray(r.faqs) ? r.faqs : [];

  // Only what the gate lets through. `about` rides on the description verdict,
  // which is how components/Profile.tsx gates it.
  const payload: Record<string, unknown> = {};
  if (conf.description === "high" && r.description) payload.description = r.description;
  if (conf.description === "high" && r.about) payload.about = r.about;
  // FAQs keep their positions — fact_confidence.faqs is aligned by index, so a
  // hidden answer is sent as null rather than dropped.
  if (srcFaqs.length) {
    payload.faqs = srcFaqs.map((f, i) => (faqConf[i] === "high" ? f : null));
  }
  if (Object.keys(payload).length === 0) { skipped++; return; }

  let out: any;
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 4000, system: SYSTEM,
        messages: [{ role: "user", content:
          `Company: ${r.name} (${r.type})\n\nTranslate the values of this JSON. Keep null entries as null.\n\n${JSON.stringify(payload, null, 2)}` }] },
      { timeout: 120_000, maxRetries: 1 },
    );
    const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) { skipped++; console.log(`· ${r.id}: no JSON back`); return; }
    out = JSON.parse(m[0]);
  } catch (e) {
    skipped++; console.log(`· ${r.id}: ${String(e).slice(0, 80)}`); return;
  }

  // ── mechanical guard ──
  const lost: string[] = [];
  const keep: Record<string, any> = {};
  for (const field of ["description", "about"] as const) {
    if (typeof payload[field] !== "string" || typeof out[field] !== "string") continue;
    const missing = lostFacts(payload[field] as string, out[field]);
    if (missing.length) lost.push(`${field}:${missing.join("/")}`);
    else keep[field] = out[field];
  }
  if (Array.isArray(payload.faqs) && Array.isArray(out.faqs) && out.faqs.length === (payload.faqs as any[]).length) {
    const src = payload.faqs as ({ q: string; a: string } | null)[];
    const faqLost: string[] = [];
    src.forEach((f, i) => {
      if (f === null) { if (out.faqs[i] !== null) faqLost.push(`${i}:shape`); return; }
      const o = out.faqs[i];
      if (!o || typeof o.q !== "string" || typeof o.a !== "string") { faqLost.push(`${i}:shape`); return; }
      const missing = lostFacts(`${f.q} ${f.a}`, `${o.q} ${o.a}`);
      if (missing.length) faqLost.push(`${i}:${missing.join("/")}`);
    });
    if (faqLost.length === 0) keep.faqs = out.faqs;
    else lost.push(`faqs(${faqLost.join(" ")})`);
  }

  if (lost.length) guarded++;
  if (Object.keys(keep).length === 0) {
    console.log(`✗ ${r.id}: guard rejected everything (${lost.join(", ")})`);
    return;
  }
  done++;
  console.log(`✎ ${r.id}: ${Object.keys(keep).join(", ")}${lost.length ? `  [dropped ${lost.join(", ")}]` : ""}`);
  if (DRY) return;

  await db
    .insert(schema.fintechTranslations)
    .values({ fintechId: r.id, locale: LOCALE, description: keep.description ?? null, about: keep.about ?? null, faqs: keep.faqs ?? null })
    .onConflictDoUpdate({
      target: [schema.fintechTranslations.fintechId, schema.fintechTranslations.locale],
      set: { description: keep.description ?? null, about: keep.about ?? null, faqs: keep.faqs ?? null, translatedAt: new Date() },
    });
}

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(one));
}
console.log(`\ndone. translated ${done}, nothing-to-do ${skipped}, guard rejections ${guarded}`);
process.exit(0);
