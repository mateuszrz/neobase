import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { runDailyKickoff } from "@/lib/ingest/kickoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await runDailyKickoff();
  return NextResponse.json({ ok: true, ...result });
}
