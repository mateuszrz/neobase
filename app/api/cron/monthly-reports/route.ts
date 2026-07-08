import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/http";
import { isClaudeLive } from "@/lib/anthropic";
import { generateProjectReport } from "@/lib/projects/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly per-project report generation (1st of the month). Regenerates the
 * Claude digest for every project owned by an entitled (active/trialing) user,
 * within a time budget. Inert until real projects exist.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  const budgetMs = 45_000;
  const CONCURRENCY = 4;

  const rows = await db.execute(sql`
    SELECT DISTINCT p.id
    FROM projects p
    JOIN subscriptions s ON s.user_id = p.user_id
    WHERE s.status IN ('active', 'trialing')
  `);
  const ids = (rows.rows as { id: string }[]).map((r) => r.id);

  let next = 0;
  let generated = 0;
  let failed = 0;
  async function worker() {
    while (Date.now() - startedAt < budgetMs) {
      const i = next++;
      if (i >= ids.length) return;
      try {
        await generateProjectReport(ids[i]);
        generated++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  return NextResponse.json({
    ok: true,
    model: isClaudeLive() ? "claude" : "composed",
    total: ids.length,
    generated,
    failed,
    remaining: ids.length - generated - failed,
    tookMs: Date.now() - startedAt,
  });
}
