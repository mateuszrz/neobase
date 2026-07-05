import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/http";
import { drainQueue } from "@/lib/ingest/drain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await drainQueue();
  return NextResponse.json({ ok: true, ...summary });
}
