/**
 * Live third-party mention ingest for one fintech + network. Requires the
 * network's search actor env (APIFY_X_SEARCH_ACTOR / APIFY_LINKEDIN_SEARCH_ACTOR
 * / APIFY_FACEBOOK_SEARCH_ACTOR) and APIFY_TOKEN:
 *
 *   npm run mentions:test -- revolut x
 *   npm run mentions:test -- revolut linkedin
 *
 * Args: <fintechId> [network=x]. Searches the network for brand mentions,
 * upserts into `mentions`, then derives sentiment toward the brand.
 */

import "dotenv/config";
import { ingestMentions } from "../lib/mentions/search.ts";
import { classifyMentions } from "../lib/mentions/sentiment.ts";
import type { MentionNetwork } from "../lib/mentions/sample.ts";

const fintechId = process.argv[2] ?? "revolut";
const network = (process.argv[3] ?? "x") as MentionNetwork;

const n = await ingestMentions(fintechId, network);
const s = n > 0 ? await classifyMentions(fintechId) : 0;
console.log(`ingested ${n} ${network} mention(s) for ${fintechId} (${s} sentiment-scored)`);
process.exit(0);
