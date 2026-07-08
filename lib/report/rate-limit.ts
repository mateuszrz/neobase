/**
 * Lightweight DB-backed rate limiting for the public "test our reports" form.
 * The expensive step is one Claude call per submit, so we cap how many reports a
 * single IP can generate in a rolling window. DB-backed (not in-memory) because
 * serverless instances are ephemeral and don't share state — we just count
 * recent report_requests rows for the IP.
 */

import { headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { reportRequests } = schema;

// Tunables — generous enough for genuine trials, tight enough to blunt abuse.
export const RATE_WINDOW_MIN = 60;
export const RATE_MAX = 5;

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return h.get("x-real-ip");
}

/** True when this IP is under the limit and may generate another report. */
export async function withinRateLimit(ip: string | null): Promise<boolean> {
  if (!ip) return true; // can't identify → don't block genuine users
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reportRequests)
    .where(and(eq(reportRequests.ip, ip), gte(reportRequests.createdAt, sql`now() - (${RATE_WINDOW_MIN} * interval '1 minute')`)));
  return (row?.n ?? 0) < RATE_MAX;
}
