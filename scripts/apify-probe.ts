/**
 * Probe a Trustpilot Apify actor: print its example input, then run it (adapted
 * to one domain, few reviews) and dump the real output shape. No DB writes.
 *
 *   npm run apify:probe -- revolut.com
 */

import "dotenv/config";
import { ApifyClient } from "apify-client";

const token = process.env.APIFY_TOKEN;
const actorId = process.env.APIFY_TRUSTPILOT_ACTOR;
const domain = process.argv[2] ?? "revolut.com";

if (!token || !actorId) {
  console.error("Set APIFY_TOKEN and APIFY_TRUSTPILOT_ACTOR in .env first.");
  process.exit(1);
}

const client = new ApifyClient({ token });

const actor = await client.actor(actorId).get();
console.log(`Actor: ${actor?.username}/${actor?.name} — "${actor?.title}"`);

// The actor ships a guaranteed-valid example input; start from it.
let input: Record<string, any> = {};
const example = (actor as any)?.exampleRunInput;
if (example?.body) {
  try {
    input = JSON.parse(example.body);
  } catch {
    /* non-JSON example, ignore */
  }
}
console.log("\nEXAMPLE INPUT (actor's own):\n", JSON.stringify(input, null, 2).slice(0, 1500));

// Adapt: point at our domain (string startUrls) and cap volume.
const reviewUrl = `https://www.trustpilot.com/review/${domain}`;
if ("startUrls" in input) input.startUrls = [reviewUrl];
else input.startUrls = [reviewUrl];
for (const k of Object.keys(input)) {
  if (/max|count|limit|reviews/i.test(k) && typeof input[k] === "number") input[k] = 5;
}

console.log("\nADAPTED INPUT (used for probe):\n", JSON.stringify(input, null, 2).slice(0, 1500));

console.log(`\nStarting a tiny run on ${domain}…`);
const run = await client.actor(actorId).call(input, { waitSecs: 300 });
console.log(`Run ${run.id} → status ${run.status}, dataset ${run.defaultDatasetId}`);

const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
console.log(`\nGot ${items.length} items. First 2 (keys + sample):\n`);
for (const it of items.slice(0, 2)) {
  console.log("keys:", Object.keys(it).join(", "));
  console.log(JSON.stringify(it, null, 2).slice(0, 1500));
  console.log("---");
}
process.exit(0);
