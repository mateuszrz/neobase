import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/http";
import { isClaudeLive } from "@/lib/anthropic";
import { generateSummary } from "@/lib/summary/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Refresh the public "✦ AI brief" for fintechs, stalest-first.
 *
 * One brief is one Claude call, so all fintechs can't regenerate inside a single
 * 60s function. Instead each run processes the oldest briefs (never-generated
 * first, then by `updated_at`) within a time budget and reports how many remain.
 * Scheduled to run daily (see vercel.json) so every brief is refreshed on a
 * rolling ~weekly cadence — it runs AFTER the drain-queue cron so briefs reflect
 * freshly-ingested ratings/news. Uses Claude when ANTHROPIC_API_KEY is set, else
 * the deterministic composer.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  const budgetMs = 45_000; // leave headroom under maxDuration for in-flight tasks
  const CONCURRENCY = 5; // each brief is I/O-bound (DB round-trips + one Claude call)

  // Stalest first: fintechs with no brief yet, then the oldest-refreshed.
  const rows = await db.execute(sql`
    SELECT f.id
    FROM fintechs f
    LEFT JOIN ai_summaries s ON s.fintech_id = f.id AND s.kind = 'weekly_brief'
    ORDER BY s.updated_at ASC NULLS FIRST
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
        await generateSummary(ids[i]);
        generated++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const processed = generated + failed;
  return NextResponse.json({
    ok: true,
    model: isClaudeLive() ? "claude" : "composed",
    total: ids.length,
    generated,
    failed,
    remaining: ids.length - processed, // picked up on the next run
    tookMs: Date.now() - startedAt,
  });
}
