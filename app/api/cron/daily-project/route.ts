import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { runKickoff } from "@/lib/ingest/orchestrate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily project kickoff. Fires every active PROJECT/daily source — the dedicated
 * per-market data a paying customer bought for their chosen brands. No-op until
 * the projects/billing phase creates project-scoped sources.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await runKickoff("daily");
  return NextResponse.json({ ok: true, ...summary });
}
