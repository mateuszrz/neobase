import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { runCrawlKickoff } from "@/lib/crawl/kickoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Weekly public crawl kickoff (Mondays). Enqueues a crawl_page job per active
 * crawl source; the drain-queue cron then fetches + diffs each. Public crawl is
 * global (country ZZ) and weekly — dedicated per-market daily crawl lands with
 * the paid projects phase.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runCrawlKickoff();
  return NextResponse.json({ ok: true, ...summary });
}
