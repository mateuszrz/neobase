import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { runKickoff } from "@/lib/ingest/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly public kickoff (Mondays). Fires every active PUBLIC/weekly source —
 * reviews (Trustpilot/Google Play/App Store, global) and page crawls (homepage/
 * pricing/offer/blog) — for the free directory. The drain-queue cron then does
 * the work. Per-market daily collection is the separate daily-project cron.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runKickoff("weekly");
  return NextResponse.json({ ok: true, ...summary });
}
