/**
 * Neon + Drizzle client.
 *
 * Uses the Neon serverless HTTP driver, which is safe under Vercel's
 * per-invocation serverless model (no long-lived pooled connections to exhaust).
 * The same client works for local scripts run via tsx.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema, casing: "snake_case" });
export { schema };
