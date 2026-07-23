/**
 * Neon + Drizzle client.
 *
 * Uses the Neon serverless HTTP driver, which is safe under Vercel's
 * per-invocation serverless model (no long-lived pooled connections to exhaust).
 * The same client works for local scripts run via tsx.
 *
 * Build hardening: Neon's SQL-over-HTTP endpoint rate-limits *connection
 * attempts*. During `next build` the prerender of ~1100 pages fires a burst of
 * queries (many pages × build workers × queries-per-page) that trips it — Neon
 * returns HTTP 500 "Too many connections attempts" and the whole build fails,
 * intermittently. Two guards, both applied at the single HTTP chokepoint every
 * query flows through (`neonConfig.fetchFunction`):
 *   1. a concurrency gate that caps simultaneous in-flight requests per process,
 *      so the burst never forms;
 *   2. a backoff+jitter retry for the rate-limit error that still slips through
 *      (e.g. across separate build-worker processes, each with its own gate).
 * Both are effectively no-ops in normal serverless traffic — a single request
 * rarely fires more than a handful of parallel queries — so they only bite at
 * build time and during large local backfill scripts.
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

const MAX_CONCURRENT = 8;
const MAX_RETRIES = 6;
const RETRYABLE = "Too many connections attempts";

// Fair FIFO semaphore. A released slot is handed straight to the next waiter
// (the counter is not decremented then re-incremented), which keeps the cap
// exact — no window where a fresh acquirer and a woken waiter both claim it.
let inFlight = 0;
const waiters: Array<() => void> = [];
async function acquire(): Promise<void> {
  if (inFlight < MAX_CONCURRENT) {
    inFlight++;
    return;
  }
  await new Promise<void>((resolve) => waiters.push(resolve));
}
function release(): void {
  const next = waiters.shift();
  if (next) next(); // hand the slot over; inFlight stays the same
  else inFlight--;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

neonConfig.fetchFunction = async (url: string, init: RequestInit): Promise<Response> => {
  await acquire();
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, init);
      if (res.ok || attempt >= MAX_RETRIES) return res;
      // Peek at the body via a clone so the response the driver reads stays intact.
      let retryable = false;
      try {
        retryable = (await res.clone().text()).includes(RETRYABLE);
      } catch {
        /* body unreadable — hand the original response back untouched */
      }
      if (!retryable) return res;
      await sleep(Math.min(2000, 100 * 2 ** attempt) + Math.floor(Math.random() * 100));
    }
  } finally {
    release();
  }
};

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema, casing: "snake_case" });
export { schema };
