import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { paddle, syncFromPaddleEvent } from "@/lib/paddle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Paddle Billing webhook. Verifies the signature, then syncs subscription.*
 * events into our subscriptions table (and reconciles the daily source set).
 * Other events are acknowledged and ignored.
 */
export async function POST(req: Request) {
  const secret = env.PADDLE_WEBHOOK_SECRET;
  const signature = req.headers.get("paddle-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "webhook not configured" }, { status: 400 });
  }

  const raw = await req.text();
  let event: { eventType?: string; data?: unknown };
  try {
    // unmarshal verifies the HMAC signature and parses the event.
    event = (await paddle().webhooks.unmarshal(raw, secret, signature)) as any;
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  if (typeof event?.eventType === "string" && event.eventType.startsWith("subscription.")) {
    try {
      const result = await syncFromPaddleEvent(event.data);
      return NextResponse.json({ ok: true, event: event.eventType, result });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ ok: false, event: event.eventType, error: message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, ignored: event?.eventType ?? "unknown" });
}
