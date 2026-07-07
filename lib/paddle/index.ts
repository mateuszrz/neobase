/**
 * Paddle Billing client + subscription sync.
 *
 * The webhook is the source of truth: on subscription.* events we upsert our
 * `subscriptions` row (linked to a user via checkout customData) and reconcile
 * the daily source set. Runs live once PADDLE_API_KEY + PADDLE_WEBHOOK_SECRET +
 * PADDLE_PRICE_* are set; until then subscriptions can be activated manually
 * (see upsertSubscription) for testing.
 */

import { Paddle, Environment } from "@paddle/paddle-node-sdk";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { packageForPriceId, type PackageId } from "@/lib/packages";
import { reconcileProjectSources } from "@/lib/projects/reconcile";

const { subscriptions } = schema;

export function paddle(): Paddle {
  return new Paddle(env.PADDLE_API_KEY, {
    environment: env.PADDLE_ENV === "production" ? Environment.production : Environment.sandbox,
  });
}

export interface SubscriptionUpsert {
  userId: string;
  packageId: PackageId;
  status: string;
  paddleSubscriptionId?: string | null;
  paddleCustomerId?: string | null;
  currentPeriodEnd?: Date | null;
}

/**
 * Upsert a subscription (one active row per user). Keyed on paddleSubscriptionId
 * when present, else on user. Reconciles project sources afterwards so a status
 * change immediately activates/deactivates that user's daily collection.
 */
export async function upsertSubscription(s: SubscriptionUpsert): Promise<void> {
  const existing = await db
    .select({ id: subscriptions.id })
    .from(subscriptions)
    .where(
      s.paddleSubscriptionId
        ? eq(subscriptions.paddleSubscriptionId, s.paddleSubscriptionId)
        : eq(subscriptions.userId, s.userId),
    )
    .limit(1);

  if (existing.length) {
    await db
      .update(subscriptions)
      .set({
        packageId: s.packageId,
        status: s.status,
        paddleSubscriptionId: s.paddleSubscriptionId ?? null,
        paddleCustomerId: s.paddleCustomerId ?? null,
        currentPeriodEnd: s.currentPeriodEnd ?? null,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing[0].id));
  } else {
    await db.insert(subscriptions).values({
      userId: s.userId,
      packageId: s.packageId,
      status: s.status,
      paddleSubscriptionId: s.paddleSubscriptionId ?? null,
      paddleCustomerId: s.paddleCustomerId ?? null,
      currentPeriodEnd: s.currentPeriodEnd ?? null,
    });
  }

  await reconcileProjectSources();
}

/**
 * Map a raw Paddle subscription event payload to our subscription and upsert it.
 * Returns a short status string for the webhook response, or throws on data we
 * can't link (missing userId customData or an unknown price id).
 */
export async function syncFromPaddleEvent(data: any): Promise<string> {
  const userId: string | undefined = data?.customData?.userId ?? data?.custom_data?.userId;
  const priceId: string | undefined = data?.items?.[0]?.price?.id;
  const pkg = priceId ? packageForPriceId(priceId) : null;

  if (!userId) return "skipped: no userId in customData";
  if (!pkg) return `skipped: unmapped price ${priceId ?? "(none)"}`;

  const endsAt = data?.currentBillingPeriod?.endsAt ?? data?.current_billing_period?.ends_at ?? null;

  await upsertSubscription({
    userId,
    packageId: pkg.id,
    status: String(data?.status ?? "active"),
    paddleSubscriptionId: data?.id ?? null,
    paddleCustomerId: data?.customerId ?? data?.customer_id ?? null,
    currentPeriodEnd: endsAt ? new Date(endsAt) : null,
  });
  return `synced: user ${userId} → ${pkg.id} (${data?.status})`;
}
