import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isAuthorizedCron } from "@/lib/http";
import { ingestNews, isDataForSeoLive } from "@/lib/news/dataforseo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly Google-News collection for the public directory (one global brand query
 * per fintech via DataForSEO). Stalest-first (never-collected, then oldest) with
 * a bounded worker pool inside a time budget; any tail is picked up next run.
 *
 * Dormant-safe: with no DataForSEO credentials it returns `skipped` without
 * calling out (the profile keeps rendering sample news). Scheduled just before
 * the weekly-briefs cron so briefs pick up fresh coverage — see vercel.json.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isDataForSeoLive()) return NextResponse.json({ ok: true, skipped: "dataforseo not configured" });

  const startedAt = Date.now();
  const budgetMs = 45_000;
  const CONCURRENCY = 6; // one external SERP call per fintech — I/O-bound

  // Stalest first: fintechs with no news yet, then the oldest-collected.
  const rows = await db.execute(sql`
    SELECT f.id, f.name
    FROM fintechs f
    LEFT JOIN LATERAL (
      SELECT max(created_at) AS last FROM news_items n WHERE n.fintech_id = f.id
    ) m ON true
    ORDER BY m.last ASC NULLS FIRST
  `);
  const fintechs = rows.rows as { id: string; name: string }[];

  let next = 0;
  let collected = 0;
  let itemsUpserted = 0;
  let failed = 0;
  async function worker() {
    while (Date.now() - startedAt < budgetMs) {
      const i = next++;
      if (i >= fintechs.length) return;
      const f = fintechs[i];
      try {
        itemsUpserted += await ingestNews(f.id, f.name, "ZZ");
        collected++;
      } catch {
        failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  const processed = collected + failed;
  return NextResponse.json({
    ok: true,
    total: fintechs.length,
    collected,
    itemsUpserted,
    failed,
    remaining: fintechs.length - processed,
    tookMs: Date.now() - startedAt,
  });
}
