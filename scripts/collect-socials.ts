/**
 * Discover each fintech's social handles by crawling its homepage and reading the
 * social links out of the footer/header, then store them on `fintechs.socials`.
 *
 *   npm run apify:socials              # fill only fintechs missing socials
 *   npm run apify:socials -- --all     # re-crawl everyone (refresh)
 *   npm run apify:socials -- --id=zen  # a single fintech
 *
 * `fintechs.socials` is the seed that `social:seed` turns into social_linkedin /
 * social_facebook sources, which the weekly-public cron then fires. Only 24 of
 * 174 fintechs had socials, so the social/mentions pipeline sat idle for the
 * rest — this fills the gap from each brand's own site.
 *
 * Homepages are static-fetched with browser headers; most brands expose their
 * socials as plain <a> links in the footer, so a single GET is enough. SPAs that
 * inject the footer with JS won't yield links — those are reported as misses, not
 * failures. Read-only: fetches public pages, writes only our own DB.
 */

import "dotenv/config";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";
import { apify } from "../lib/apify/index.ts";

const { fintechs } = schema;

type Network = "linkedin" | "facebook" | "twitter" | "instagram" | "youtube" | "tiktok";
const NETWORKS: Network[] = ["linkedin", "facebook", "twitter", "instagram", "youtube", "tiktok"];
type Socials = Record<Network, string>;
const emptySocials = (): Socials => ({ linkedin: "", facebook: "", twitter: "", instagram: "", youtube: "", tiktok: "" });

// Host → network. Order matters only for lookup; matching is by hostname suffix.
const HOST_NET: Array<[RegExp, Network]> = [
  [/(^|\.)linkedin\.com$/i, "linkedin"],
  [/(^|\.)facebook\.com$/i, "facebook"],
  [/(^|\.)fb\.com$/i, "facebook"],
  [/(^|\.)x\.com$/i, "twitter"],
  [/(^|\.)twitter\.com$/i, "twitter"],
  [/(^|\.)instagram\.com$/i, "instagram"],
  [/(^|\.)youtube\.com$/i, "youtube"],
  [/(^|\.)youtu\.be$/i, "youtube"],
  [/(^|\.)tiktok\.com$/i, "tiktok"],
];

// Non-profile paths to reject per network (share widgets, intents, generic pages).
const REJECT: Record<Network, RegExp[]> = {
  linkedin: [/^\/(shareArticle|share|sharing|cws|feed|posts|pulse|jobs|learning|help|legal)\b/i, /^\/?$/],
  facebook: [/^\/(sharer|dialog|plugins|tr\b|sharer\.php|dialog\/|login|help|policies|business\/?$)/i, /^\/?$/],
  twitter: [/^\/(intent|share|home|hashtag|search|i\/|explore|login|privacy|tos)\b/i, /^\/?$/],
  instagram: [/^\/(p|reel|explore|accounts|about)\b/i, /^\/?$/],
  youtube: [/^\/(watch|embed|results|feed|hashtag)\b/i],
  tiktok: [/^\/(tag|search|foryou|discover)\b/i, /^\/?$/],
};

/** Score a candidate profile URL for a network — higher wins when a site links
 *  several URLs of the same network (e.g. a company page plus a post). */
function score(net: Network, path: string): number {
  const p = path.replace(/\/+$/, "");
  if (net === "linkedin") {
    if (/^\/company\//i.test(p)) return 100;
    if (/^\/(in|school|showcase)\//i.test(p)) return 80;
    return 40;
  }
  if (net === "youtube") {
    if (/^\/(@|c\/|channel\/|user\/)/i.test(p)) return 100;
    return 40;
  }
  // For the handle-style networks a single clean path segment is the profile.
  const segs = p.split("/").filter(Boolean);
  if (segs.length === 1) return 100;
  return 40;
}

// Canonical host per network (x.com over twitter.com, matching the existing seed).
const CANON_HOST: Record<Network, string> = {
  linkedin: "linkedin.com", facebook: "facebook.com", twitter: "x.com",
  instagram: "instagram.com", youtube: "youtube.com", tiktok: "tiktok.com",
};

function normalize(net: Network, u: URL): string | null {
  const path = u.pathname.replace(/\/+$/, "") || "/";
  if (REJECT[net].some((re) => re.test(path))) return null;
  // Canonical host + path, dropping query/hash (utm, ref, locale).
  return `https://${CANON_HOST[net]}${path === "/" ? "" : path}`;
}

function extractSocials(html: string): Socials {
  const out = emptySocials();
  const best: Partial<Record<Network, number>> = {};
  // Grab every href; also catch bare og:see_also / JSON-embedded URLs.
  const hrefs = new Set<string>();
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) hrefs.add(m[1]);
  for (const m of html.matchAll(/https?:\/\/(?:www\.)?(?:linkedin\.com|facebook\.com|fb\.com|x\.com|twitter\.com|instagram\.com|youtube\.com|youtu\.be|tiktok\.com)\/[^\s"'<>\\)]+/gi)) hrefs.add(m[0]);

  for (const raw of hrefs) {
    let u: URL;
    try {
      u = new URL(raw.startsWith("//") ? "https:" + raw : raw);
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^www\./i, "");
    const hit = HOST_NET.find(([re]) => re.test(host));
    if (!hit) continue;
    const net = hit[1];
    const url = normalize(net, u);
    if (!url) continue;
    const sc = score(net, u.pathname);
    if (sc > (best[net] ?? -1)) {
      best[net] = sc;
      out[net] = url;
    }
  }
  return out;
}

async function fetchHome(website: string): Promise<string | null> {
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const headers = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };
  for (const target of [url, url.replace("https://", "https://www.")]) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(target, { headers, redirect: "follow", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        const html = await res.text();
        if (html.length > 200) return html;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Second-pass fetch via Apify's website-content-crawler — a headless render with
 * anti-bot and residential proxies. Gets the footer of JS-rendered SPAs (binance,
 * htx, mexc) and the pages that block a datacenter-IP fetch (coinbase, bitvavo).
 * Slower and paid, so it only runs under --render. saveHtml keeps the raw <a>
 * hrefs the extractor needs (markdown would drop icon-only footer links).
 */
async function renderFetch(website: string): Promise<string | null> {
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  try {
    const client = apify();
    const run = await client.actor("apify/website-content-crawler").call(
      {
        startUrls: [{ url }],
        maxCrawlDepth: 0,
        maxCrawlPages: 1,
        crawlerType: "playwright:adaptive",
        saveHtml: true,
        // Keep the WHOLE page: the default readability transform + element removal
        // strip nav/footer, which is exactly where the social links live.
        htmlTransformer: "none",
        removeElementsCssSelector: "",
      },
      { waitSecs: 150 },
    );
    const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1, clean: true });
    const html = String((items[0] as Record<string, any> | undefined)?.html ?? "");
    return html.length > 200 ? html : null;
  } catch {
    return null;
  }
}

const args = process.argv.slice(2);
const doAll = args.includes("--all");
const missesMode = args.includes("--misses");
const doRender = args.includes("--render") || missesMode;
const onlyId = args.find((a) => a.startsWith("--id="))?.slice(5);

// --misses targets the brands the plain-fetch pass left without a linkedin OR
// facebook handle (what the social pipeline actually needs) and always renders.
const missWhere = or(
  isNull(fintechs.socials),
  and(sql`coalesce(${fintechs.socials}->>'linkedin','') = ''`, sql`coalesce(${fintechs.socials}->>'facebook','') = ''`),
);
const where = onlyId ? eq(fintechs.id, onlyId) : missesMode ? missWhere : doAll ? undefined : isNull(fintechs.socials);
const rows = await db
  .select({ id: fintechs.id, name: fintechs.name, website: fintechs.website, socials: fintechs.socials })
  .from(fintechs)
  .where(where as any);

console.log(`crawling ${rows.length} fintech homepage(s) for socials${doRender ? " (render fallback on)" : ""}…\n`);

// Render is slow/paid; run it narrow. Plain-fetch pass stays wide.
const CONCURRENCY = missesMode ? 3 : 8;
let found = 0;
let miss = 0;
let nofound = 0;

/** Keep existing non-empty handles, fill only the ones we newly discovered. */
function merge(cur: unknown, found: Socials): Socials {
  const base = cur && typeof cur === "object" ? (cur as Record<string, unknown>) : {};
  const out = emptySocials();
  for (const n of NETWORKS) {
    const existing = typeof base[n] === "string" ? (base[n] as string) : "";
    out[n] = existing || found[n] || "";
  }
  return out;
}

async function run(row: (typeof rows)[number]): Promise<void> {
  if (!row.website) {
    console.log(`  ${row.id.padEnd(22)} — no website`);
    miss++;
    return;
  }
  let html = await fetchHome(row.website);
  let via = "fetch";
  let scraped = html ? extractSocials(html) : emptySocials();
  // Escalate to the headless render when the cheap fetch didn't yield the two
  // networks the pipeline needs (linkedin/facebook).
  if (doRender && !scraped.linkedin && !scraped.facebook) {
    const rendered = await renderFetch(row.website);
    if (rendered) { html = rendered; scraped = extractSocials(rendered); via = "render"; }
  }
  if (!html) {
    console.log(`  ${row.id.padEnd(22)} — fetch failed (${row.website})`);
    miss++;
    return;
  }
  const fresh = NETWORKS.filter((n) => scraped[n]);
  if (fresh.length === 0) {
    console.log(`  ${row.id.padEnd(22)} — no social links on page (${via})`);
    nofound++;
    return;
  }
  const socials = merge(row.socials, scraped);
  const hits = NETWORKS.filter((n) => socials[n]);
  await db.update(fintechs).set({ socials }).where(eq(fintechs.id, row.id));
  found++;
  console.log(`  ${row.id.padEnd(22)} ✓ [${hits.join(", ")}] (${via})`);
}

for (let i = 0; i < rows.length; i += CONCURRENCY) {
  await Promise.all(rows.slice(i, i + CONCURRENCY).map(run));
}

// How many now have at least a linkedin or facebook (what social:seed needs)?
const seedable = await db.execute(
  sql`SELECT count(*)::int n FROM fintechs WHERE (socials->>'linkedin') <> '' OR (socials->>'facebook') <> ''`,
);

console.log(
  `\ndone — updated ${found}, no links ${nofound}, fetch/website miss ${miss}. ` +
    `${(seedable.rows as any[])[0].n} fintech(s) now have a linkedin/facebook handle for social:seed.`,
);
process.exit(0);
