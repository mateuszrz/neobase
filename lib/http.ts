/**
 * Auth guards for cron + webhook routes.
 *
 * Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET env var is set. We also accept `?token=` for manual local runs.
 *
 * Both guards used to allow everything whenever their secret was unset — handy
 * locally, but CRON_SECRET was not set in production, which left every
 * /api/cron/* route callable by anyone. Those routes spend real money on Claude
 * and Apify calls. For cron, an unset secret is now a local-only convenience:
 * a production build denies instead of allowing, so the routes cannot silently
 * reopen if the variable is removed or a new environment is provisioned
 * without it.
 */

import { env, isProductionRuntime } from "@/lib/env";

/**
 * Constant-time comparison, so a caller cannot recover the secret by measuring
 * how long a wrong guess takes to be rejected.
 */
function secretMatches(candidate: string | null, secret: string): boolean {
  if (!candidate || candidate.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= candidate.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

/**
 * @param requireInProduction when true, a missing secret denies in production
 *   builds rather than waving the caller through.
 */
function authorize(req: Request, secret: string, requireInProduction: boolean): boolean {
  if (!secret) return !(requireInProduction && isProductionRuntime());
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && secretMatches(auth.slice(7), secret)) return true;
  return secretMatches(new URL(req.url).searchParams.get("token"), secret);
}

export function isAuthorizedCron(req: Request): boolean {
  return authorize(req, env.CRON_SECRET, true);
}

/**
 * NOT yet fail-closed, deliberately.
 *
 * APIFY_WEBHOOK_SECRET is currently unset in production — verified by a call
 * with a bogus token being accepted — so this endpoint is open to anyone, who
 * could enqueue dataset-processing jobs with it. Tightening it before the
 * variable is set would reject Apify's real callbacks and silently stop review
 * ingestion, which is worse than the exposure.
 *
 * To close it: set APIFY_WEBHOOK_SECRET on Vercel, redeploy, then flip the last
 * argument to `true`. The token travels in the webhook URL that
 * lib/apify/index.ts registers at run start, so runs started after the variable
 * lands carry it automatically; only runs already in flight at that moment
 * would be rejected.
 */
export function isAuthorizedApifyWebhook(req: Request): boolean {
  return authorize(req, env.APIFY_WEBHOOK_SECRET, false);
}
