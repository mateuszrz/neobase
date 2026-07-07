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
  // Model for crawl content extraction + diff summaries. Defaults to Opus 4.8;
  // Haiku 4.5 (claude-haiku-4-5) is a strong cheaper pick for this high-volume,
  // structured-extraction workload — set here to switch the whole crawl pipeline.
  ANTHROPIC_CRAWL_MODEL: process.env.ANTHROPIC_CRAWL_MODEL ?? "claude-opus-4-8",
  // Apify actor used as the fetch fallback when a direct fetch() is empty/blocked.
  APIFY_CRAWLER_ACTOR: process.env.APIFY_CRAWLER_ACTOR ?? "apify/website-content-crawler",

  PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? "",
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET ?? "",
  PADDLE_ENV: process.env.PADDLE_ENV ?? "sandbox", // sandbox | production
};

/** True once a Paddle API key is configured (else billing runs in manual mode). */
export const isPaddleLive = () => Boolean(env.PADDLE_API_KEY);

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
