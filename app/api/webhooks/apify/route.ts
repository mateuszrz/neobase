import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isAuthorizedApifyWebhook } from "@/lib/http";
import { enqueue } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const { ingestRuns } = schema;

/**
 * Apify run-completion webhook. Does near-zero work: verify secret, mark the
 * ingest_run, enqueue a process_dataset job, return 200 immediately. All heavy
 * lifting happens later in the drain-queue cron.
 */
export async function POST(req: Request) {
  if (!isAuthorizedApifyWebhook(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams.entries());
  const body = (await req.json().catch(() => ({}))) as any;

  const eventType: string = body?.eventType ?? "";
  const datasetId: string | undefined = body?.resource?.defaultDatasetId ?? q.datasetId;
  const runKey = q.runKey;

  if (eventType.endsWith("FAILED")) {
    if (runKey) {
      await db
        .update(ingestRuns)
        .set({ status: "failed", finishedAt: new Date() })
        .where(eq(ingestRuns.runKey, runKey));
    }
    return NextResponse.json({ ok: true, handled: "failed" });
  }

  if (runKey) {
    await db
      .update(ingestRuns)
      .set({ status: "succeeded", datasetId: datasetId ?? null, finishedAt: new Date() })
      .where(eq(ingestRuns.runKey, runKey));
  }

  if (q.sourceId && q.fintechId && datasetId) {
    await enqueue({
      type: "process_dataset",
      payload: {
        sourceId: q.sourceId,
        fintechId: q.fintechId,
        kind: "trustpilot",
        snapshotDate: q.snapshotDate ?? new Date().toISOString().slice(0, 10),
        mock: false,
        datasetId,
        offset: 0,
        runKey,
      },
    });
  }

  return NextResponse.json({ ok: true, handled: "succeeded" });
}
