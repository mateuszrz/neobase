/**
 * Live social ingest for one fintech (requires APIFY_LINKEDIN_ACTOR /
 * APIFY_FACEBOOK_ACTOR + a handle in fintechs.socials):
 *
 *   npm run social:test -- revolut linkedin
 *
 * Fetches real posts via Apify and upserts them into social_posts; the public
 * profile then shows real posts instead of the sample preview.
 */

import "dotenv/config";
import { ingestSocial } from "../lib/social/apify.ts";
import type { SocialNetwork } from "../lib/social/sample.ts";

const fintechId = process.argv[2] ?? "revolut";
const network = (process.argv[3] as SocialNetwork) ?? "linkedin";

const n = await ingestSocial(fintechId, network);
console.log(`ingested ${n} ${network} post(s) for ${fintechId}`);
process.exit(0);
