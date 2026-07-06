/**
 * Central, typed access to environment variables.
 * Only DATABASE_URL is hard-required; everything else has a safe default so the
 * MVP can run in mock mode without external accounts wired up.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  get DATABASE_URL() {
    return required("DATABASE_URL");
  },
  APP_BASE_URL: process.env.APP_BASE_URL ?? "http://localhost:3000",
  CRON_SECRET: process.env.CRON_SECRET ?? "",
  APIFY_WEBHOOK_SECRET: process.env.APIFY_WEBHOOK_SECRET ?? "",

  APIFY_TOKEN: process.env.APIFY_TOKEN ?? "",
  APIFY_TRUSTPILOT_ACTOR: process.env.APIFY_TRUSTPILOT_ACTOR ?? "",
  APIFY_GOOGLE_PLAY_ACTOR: process.env.APIFY_GOOGLE_PLAY_ACTOR ?? "",
  APIFY_APPSTORE_ACTOR: process.env.APIFY_APPSTORE_ACTOR ?? "",

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",

  PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? "",
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET ?? "",
};

/** Source kinds that have a live Apify scraper wired up. */
export type ScrapableKind = "trustpilot" | "google_play" | "app_store";

/** Resolve the configured Apify actor id for a source kind ("" if unset). */
export function apifyActorFor(kind: string): string {
  switch (kind) {
    case "trustpilot":
      return env.APIFY_TRUSTPILOT_ACTOR;
    case "google_play":
      return env.APIFY_GOOGLE_PLAY_ACTOR;
    case "app_store":
      return env.APIFY_APPSTORE_ACTOR;
    default:
      return "";
  }
}

/**
 * When no Apify token is present we run the whole pipeline against local fixtures.
 * Per-kind actor availability is checked separately via {@link apifyActorFor}.
 */
export const isApifyLive = () => Boolean(env.APIFY_TOKEN);
