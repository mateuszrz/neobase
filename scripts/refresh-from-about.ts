/**
 * Fill in the thin exchanges' factual fields from THEIR OWN website. For each
 * exchange still missing a description/founding year, we fetch the homepage plus
 * a few likely About/legal/imprint pages (free direct fetch; one Apify render as
 * a last resort when everything is JS-only), then Claude extracts the facts the
 * pages actually support — country, founded, HQ, employees, valuation, status,
 * licences/regulator, a one-line description and a short `about`.
 *
 * Complements scripts/refresh-from-wikipedia (which can't help brands with no
 * Wikipedia article). Conservative: only fills fields the site supports.
 *
 *   npm run data:about                    # all thin exchanges
 *   npm run data:about -- --only bit2me,whitebit
 *   npm run data:about -- --dry
 */

import "dotenv/config";
import { sql, eq } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { fetchPage } from "../lib/crawl/fetch.ts";
import { anthropic, isClaudeLive } from "../lib/anthropic/index.ts";
import { env } from "../lib/env.ts";

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const only = (argv.includes("--only") ? argv[argv.indexOf("--only") + 1] : "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const CONC = 4;

if (!isClaudeLive()) { console.log("ANTHROPIC_API_KEY not set"); process.exit(1); }

const PATHS = ["", "/about", "/about-us", "/company", "/en/about", "/legal", "/imprint", "/about/company"];
const FIELDS = ["country", "founded", "headquarters", "employees", "valuationUsd", "status", "licenses", "description", "about"] as const;

async function gather(website: string): Promise<string> {
  const base = `https://${website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}`;
  const chunks: string[] = [];
  let anyDirect = false;
  for (const p of PATHS) {
    if (chunks.join("").length > 9000) break;
    try {
      const page = await fetchPage(base + p, { directOnly: true });
      if (page.text && page.text.length > 250) {
        anyDirect = true;
        chunks.push(`# ${base + p}\n${page.text.slice(0, 3000)}`);
      }
    } catch { /* miss */ }
  }
  // Everything JS-only? one rendered homepage via Apify.
  if (!anyDirect) {
    try {
      const page = await fetchPage(base, {});
      if (page.text) chunks.push(`# ${base}\n${page.text.slice(0, 4000)}`);
    } catch { /* give up */ }
  }
  return chunks.join("\n\n").slice(0, 11000);
}

const SYSTEM =
  "You extract factual company data for a crypto-exchange directory from the company's OWN website text. " +
  "Return ONLY fields the text actually supports — never guess a founding year, employee count or valuation that " +
  "isn't stated. Rules:\n" +
  "- country: ISO-3166 alpha-2 of HQ/registration. founded: 4-digit year. employees/valuationUsd: integers.\n" +
  "- headquarters: \"City, Country\". status: short (e.g. 'active').\n" +
  "- licenses: array of short strings \"<Regulator> (<ISO2>)\" + licence type if stated, e.g. [\"BaFin (DE)\", \"MiCA licence\"]. " +
  "Use the ACTUAL supervising authority named on the site (often in the footer/legal page).\n" +
  "- description: one factual sentence. about: 2-3 sentence neutral overview.\n" +
  "Respond with ONLY JSON: {\"changes\": { ...only supported fields } }. Empty object if the text is unusable.";

const rowsAll = await db.execute(sql`
  select id, name, website, country, founded, headquarters, employees, valuation_usd as "valuationUsd", status, licenses, description, about
  from fintechs where type='exchange' and (description is null or founded is null) order by id`);
let rows = (rowsAll.rows as any[]).filter((r) => r.website);
if (only.length) rows = rows.filter((r) => only.includes(r.id));
console.log(`about-crawl ${rows.length} thin exchanges${DRY ? " (dry)" : ""}…\n`);

let filled = 0, empty = 0, nofetch = 0;
async function one(r: any) {
  const text = await gather(r.website);
  if (!text || text.length < 300) { nofetch++; console.log(`· ${r.id}: no usable page`); return; }
  const current = {
    country: r.country, founded: r.founded, headquarters: r.headquarters, employees: r.employees,
    valuationUsd: r.valuationUsd, status: r.status, licenses: r.licenses, description: r.description, about: r.about,
  };
  let out: any;
  try {
    const res = await anthropic().messages.create(
      { model: env.ANTHROPIC_CRAWL_MODEL, max_tokens: 1500, system: SYSTEM,
        messages: [{ role: "user", content: `Company: ${r.name}\nCurrent (nulls need filling): ${JSON.stringify(current)}\n\nWEBSITE TEXT:\n${text}` }] },
      { timeout: 90_000, maxRetries: 1 },
    );
    const t = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) { empty++; return; }
    out = JSON.parse(m[0]);
  } catch { empty++; return; }

  const ch = out?.changes ?? {};
  const set: Record<string, any> = {};
  // Only fill fields that are currently empty, or improve licenses/description.
  for (const f of FIELDS) {
    if (!(f in ch) || ch[f] == null) continue;
    const cur = (current as any)[f];
    if (cur == null || cur === "" || (Array.isArray(cur) && cur.length === 0) || f === "licenses" || f === "description") set[f] = ch[f];
  }
  const keys = Object.keys(set);
  if (!keys.length) { empty++; console.log(`· ${r.id}: nothing extractable`); return; }
  filled++;
  console.log(`✎ ${r.id}: ${keys.map((k) => k === "licenses" ? `licenses=${JSON.stringify(set[k])}` : k === "about" ? "about*" : `${k}=${JSON.stringify(set[k])}`).join(", ")}`);
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
  if ("about" in set) dbSet.about = String(set.about);
  dbSet.updatedAt = new Date();
  await db.update(schema.fintechs).set(dbSet).where(eq(schema.fintechs.id, r.id));
}

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(one));
}
console.log(`\ndone. filled ${filled}, nothing ${empty}, no-fetch ${nofetch}`);
process.exit(0);
