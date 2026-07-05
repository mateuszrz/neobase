/**
 * Local pipeline runner (no HTTP / cron needed):
 *   npm run pipeline:kickoff   # enqueue today's process jobs
 *   npm run pipeline:drain     # process the whole queue
 */

import "dotenv/config";
import { runDailyKickoff } from "../lib/ingest/kickoff.ts";
import { drainQueue } from "../lib/ingest/drain.ts";

const cmd = process.argv[2];

if (cmd === "kickoff") {
  console.log("kickoff:", await runDailyKickoff());
} else if (cmd === "drain") {
  console.log("drain:", await drainQueue(1000));
} else {
  console.error("usage: run-local.ts <kickoff|drain>");
  process.exit(1);
}
process.exit(0);
