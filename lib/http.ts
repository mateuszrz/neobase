/**
 * Auth guards for cron + webhook routes.
 *
 * Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET env var is set. We also accept `?token=` for manual local runs.
 */

import { env } from "@/lib/env";

export function isAuthorizedCron(req: Request): boolean {
  if (!env.CRON_SECRET) return true; // dev convenience when unset
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${env.CRON_SECRET}`) return true;
  const token = new URL(req.url).searchParams.get("token");
  return token === env.CRON_SECRET;
}

export function isAuthorizedApifyWebhook(req: Request): boolean {
  if (!env.APIFY_WEBHOOK_SECRET) return true;
  const token = new URL(req.url).searchParams.get("token");
  return token === env.APIFY_WEBHOOK_SECRET;
}
