/**
 * Ground the directory's factual fields in Wikipedia. For each fintech we pull
 * the Wikipedia intro (best-effort) and let Claude reconcile the FACTUAL fields
 * — country, founded, HQ, employees, valuation, status, licences/regulator,
 * short description — plus fix any factual error embedded in the generated FAQs
 * (e.g. the wrong "supervised by KNF" claim for a Lithuanian-licensed EMI).
 * Curated prose (`about`, tags) is left untouched. Nothing is changed when the
 * model isn't confident it matched the right company.
 *
 *   npm run data:wiki                     # all
 *   npm run data:wiki -- --only zen,revolut
 *   npm run data:wiki -- --limit 20 --dry
 */

import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const only = (argv.find((a) => a.startsWith("--only="))?.split("=")[1]
  ?? (argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : ""))
  .split(",").map((s) => s.trim()).filter(Boolean);
const limit = Number(argv.includes("--limit") ? argv[argv.indexOf("--limit") + 1] : 0) || 0;
const CONC = 5;

if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const UA = "NeoBaseBot/1.0 (https://neobase.co; data refresh)";
async function wiki(name: string, type: string, website: string | null): Promise<string> {
  const hint = type === "exchange" ? "cryptocurrency exchange" : "neobank digital bank fintech";
  try {
    const s = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srlimit=1&srsearch=${encodeURIComponent(`${name} ${hint}`)}`,
      { headers: { "User-Agent": UA } },
    ).then((r) => r.json() as any);
    const hit = s?.query?.search?.[0];
    if (!hit) return "";
    const e = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&redirects=1&pageids=${hit.pageid}`,
      { headers: { "User-Agent": UA } },
    ).then((r) => r.json() as any);
    const page = e?.query?.pages?.[hit.pageid];
    const extract: string = page?.extract ?? "";
    return `TITLE: ${page?.title ?? hit.title}\n${extract}`.slice(0, 4000);
  } catch {
    return "";
  }
}

const FIELDS = ["country", "founded", "headquarters", "employees", "valuationUsd", "status", "licenses", "description", "faqs"] as const;

const SYSTEM =
  "You are a data steward for a fintech/crypto-exchange directory. Given a company's current stored record, its " +
  "website domain, and the intro of a Wikipedia article we retrieved, CORRECT the factual fields. Rules:\n" +
  "- FIRST confirm the Wikipedia extract is really about THIS company (match the domain/description). If it clearly " +
  "isn't, or there is no usable extract, set \"confident\": false and return \"changes\": {}.\n" +
  "- Only include a field in \"changes\" when you are changing it to a more accurate value. Omit unchanged fields.\n" +
  "- country: ISO-3166 alpha-2 of HQ/origin. founded: 4-digit year. employees: integer. valuationUsd: integer USD.\n" +
  "- headquarters: \"City, Country\". status: short (e.g. 'active', 'acquired', 'defunct').\n" +
  "- licenses: array of short strings \"<Regulator> (<ISO2>)\" plus a licence-type tag if known, e.g. " +
  "[\"Bank of Lithuania (LT)\", \"EMI licence\"]. Fix wrong regulators (a common error is naming the wrong national " +
  "authority). Use the ACTUAL supervising authority.\n" +
  "- description: one factual sentence. faqs: return the full corrected array ONLY if an answer contained a factual " +
  "error (e.g. wrong regulator/country); keep the same questions and structure; otherwise omit faqs.\n" +
  "- Never invent data you can't support. Respond with ONLY JSON: {\"confident\": bool, \"changes\": { ...fields }}.";

const rowsAll = await db.select().from(schema.fintechs);
let rows = only.length ? rowsAll.filter((r) => only.includes(r.id)) : rowsAll;
if (limit) rows = rows.slice(0, limit);
console.log(`refreshing ${rows.length} fintechs${DRY ? " (dry)" : ""}…\n`);

let changed = 0, skipped = 0, nowiki = 0;
async function one(r: (typeof rows)[number]) {
  const host = (r.website ?? "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  const extract = await wiki(r.name, r.type, r.website);
  if (!extract) { nowiki++; return; }
  const current = {
    country: r.country, founded: r.founded, headquarters: r.headquarters, employees: r.employees,
    valuationUsd: r.valuationUsd, status: r.status, licenses: r.licenses, description: r.description, faqs: r.faqs,
  };
  let out: any;
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 2000, system: SYSTEM,
        messages: [{ role: "user", content:
          `Company: ${r.name} (${r.type})\nWebsite: ${host || "?"}\n\nCURRENT RECORD:\n${JSON.stringify(current)}\n\nWIKIPEDIA:\n${extract}` }] },
      { timeout: 90_000, maxRetries: 1 },
    );
    const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) { skipped++; return; }
    out = JSON.parse(m[0]);
  } catch { skipped++; return; }

  const ch = out?.confident ? (out.changes ?? {}) : {};
  const set: Record<string, any> = {};
  for (const f of FIELDS) if (f in ch && ch[f] != null) set[f] = ch[f];
  const keys = Object.keys(set);
  if (!keys.length) { skipped++; return; }
  changed++;
  console.log(`✎ ${r.id}: ${keys.map((k) => k === "licenses" ? `licenses=${JSON.stringify(set[k])}` : k === "faqs" ? "faqs*" : `${k}=${JSON.stringify(set[k])}`).join(", ")}`);
  if (DRY) return;
  const dbSet: any = {};
  if ("country" in set) dbSet.country = String(set.country).toUpperCase().slice(0, 2);
  if ("founded" in set) dbSet.founded = Number(set.founded) || null;
  if ("headquarters" in set) dbSet.headquarters = String(set.headquarters);
  if ("employees" in set) dbSet.employees = Number(set.employees) || null;
  if ("valuationUsd" in set) dbSet.valuationUsd = Number(set.valuationUsd) || null;
  if ("status" in set) dbSet.status = String(set.status);
  if ("licenses" in set) dbSet.licenses = set.licenses;
  if ("description" in set) dbSet.description = String(set.description);
  if ("faqs" in set) dbSet.faqs = set.faqs;
  dbSet.updatedAt = new Date();
  await db.update(schema.fintechs).set(dbSet).where(eq(schema.fintechs.id, r.id));
}

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(one));
}
console.log(`\ndone. changed ${changed}, unchanged ${skipped}, no-wikipedia ${nowiki}`);
process.exit(0);
