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

  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",

  PADDLE_API_KEY: process.env.PADDLE_API_KEY ?? "",
  PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET ?? "",
};

/** When no Apify token is present we run the whole pipeline against local fixtures. */
export const isApifyLive = () => Boolean(env.APIFY_TOKEN && env.APIFY_TRUSTPILOT_ACTOR);
