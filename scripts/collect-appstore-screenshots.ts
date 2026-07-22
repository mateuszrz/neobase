/**
 * App Store screenshots — a dedicated scraper, because Apple deprecated the
 * screenshot fields in the iTunes lookup API (returns []) and the Apify App
 * Store actor relies on the same API. The public web page still ships them in
 * the HTML, so we fetch it directly (browser headers required — a plain UA gets
 * an empty body) and extract the full-resolution portrait screenshot URLs.
 *
 * Stored under fintechs.screenshots.appStore, merged with the Google Play set.
 * Sequential with a small delay to stay polite and avoid a block.
 *
 *   npm run apify:appstore-screenshots           # all with an active app_store source
 *   npm run apify:appstore-screenshots -- 20     # limit
 */
import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "../lib/db/index.ts";

const { fintechs, sources } = schema;
const LIMIT = Number(process.argv[2] ?? 100000);
const MAX = 6;
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-GB,en;q=0.9",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Extract screenshot URLs from an App Store page's HTML. Apple's markup is
 * inconsistent — some apps embed a `_1242x2208` dimension, others none — but the
 * screenshots always live under a `PurpleSource` path (icons/placeholders/video
 * posters do not). So filter on that, drop landscape/iPad shots when the
 * dimensions are known, and take the first few.
 */
function extractScreenshots(html: string): string[] {
  const tpl = [...new Set(html.match(/https:\/\/[^"\s]+?\/\{w\}x\{h\}\{c\}\.\{f\}/g) ?? [])];
  const out: string[] = [];
  for (const u of tpl) {
    if (!/PurpleSource/i.test(u)) continue;
    if (/appicon|placeholder|\.mill|logo|artist|messages|preview|videoposter/i.test(u)) continue;
    const m = u.match(/_(\d{3,4})x(\d{3,4})\w*\.(?:png|jpg|webp)\//);
    if (m && Number(m[2]) < Number(m[1])) continue; // known dims → portrait only
    out.push(u.replace("{w}x{h}{c}.{f}", "440x0w.webp"));
    if (out.length >= MAX) break;
  }
  return out;
}

const targets = (await db.execute(sql`
  SELECT f.id, s.external_ref AS ref, s.country AS src_country, f.country AS ft_country, f.screenshots
  FROM ${fintechs} f
  JOIN ${sources} s ON s.fintech_id = f.id AND s.kind = 'app_store' AND s.active = true
  ORDER BY f.id
  LIMIT ${LIMIT}
`)).rows as any[];
console.log(`Scraping App Store screenshots for ${targets.length} fintechs…\n`);

let ok = 0, none = 0, err = 0;
for (const t of targets) {
  const cc = (t.src_country && String(t.src_country) !== "ZZ" ? String(t.src_country) : t.ft_country ? String(t.ft_country) : "us").toLowerCase();
  try {
    const res = await fetch(`https://apps.apple.com/${cc}/app/id${t.ref}`, { headers: HEADERS });
    const html = res.ok ? await res.text() : "";
    const shots = extractScreenshots(html);
    if (!shots.length) { none++; console.log(`  ∅ ${t.id}`); }
    else {
      const cur = t.screenshots && typeof t.screenshots === "object" ? t.screenshots : {};
      await db.update(fintechs).set({ screenshots: { ...cur, appStore: shots } }).where(eq(fintechs.id, t.id));
      ok++;
      console.log(`  ✓ ${t.id.padEnd(16)} ${shots.length} shots (${cc})`);
    }
  } catch (e) {
    err++;
    console.log(`  ✗ ${t.id.padEnd(16)} ${(e as Error).message.slice(0, 50)}`);
  }
  await sleep(250);
}
console.log(`\ndone — ${ok} with App Store screenshots, ${none} none, ${err} errors.`);
process.exit(0);
