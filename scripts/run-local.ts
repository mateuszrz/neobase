/**
 * Local pipeline runner (no HTTP / cron needed):
 *   npm run pipeline:kickoff [weekly|daily]   # enqueue a cadence's jobs (default weekly)
 *   npm run pipeline:drain                     # process the whole queue
 */

import "dotenv/config";
import { runKickoff, type Cadence } from "../lib/ingest/orchestrate.ts";
import { drainQueue } from "../lib/ingest/drain.ts";

const cmd = process.argv[2];

if (cmd === "kickoff") {
  const cadence = (process.argv[3] as Cadence) ?? "weekly";
  console.log(`kickoff (${cadence}):`, await runKickoff(cadence));
} else if (cmd === "drain") {
  console.log("drain:", await drainQueue(1000));
} else {
  console.error("usage: run-local.ts <kickoff [weekly|daily]|drain>");
  process.exit(1);
}
process.exit(0);
