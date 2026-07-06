# NeoBase — Session handoff (resume here)

_Last worked: 2026-07-06. Branch `feat/saas-mvp` — **merged to `main` and DEPLOYED to Vercel production (green).**_

## What NeoBase is now

Rebuilding the old static `neobase.co` SPA into a **fintech competitive-intelligence SaaS**:
1. **Public directory** (free, SEO) — neobanks + crypto exchanges, ratings/sentiment/trends. **LIVE in production.**
2. **Paid monitoring panel** (later) — buy a country + competitors, daily data + Claude AI digests, billed via Paddle.

Full plan: `C:\Users\PC\.claude\plans\merry-cuddling-hollerith.md`.

## Stack

- **Next.js 16 (App Router)** on Vercel (production) · **Neon Postgres** via Drizzle (HTTP driver, shared between local + prod) · Claude API (later) · Paddle (later).
- **Apify** scraping — **histogram-only, anonymized** (see below). Orchestration: Vercel Cron + Apify webhooks + Postgres `job_queue`.
- Design system **"Seline"** (`DESIGN.md`) — warm paper, one cyan accent, hairline cards, editorial rhythm.

## ⚠️ DO FIRST — set `APP_BASE_URL` on Vercel (blocks the daily pipeline)

The daily cron starts Apify runs but `startActorRun` only registers the completion **webhook** when `APP_BASE_URL` is an https non-localhost URL. Until it's set in **Vercel → Settings → Environment Variables** (Production **and** Preview), completed runs never enqueue processing → **no new daily data → trends don't grow.** Set it to the prod URL (no trailing slash), then Redeploy. This is a dashboard action (no Vercel token/access from here).

## Ingestion — HISTOGRAM-ONLY, ANONYMIZED (no reviews, no PII)

Every source fetches only the aggregate (rating + total count + 1–5★ histogram); sentiment is derived from the histogram (lifetime). ~**$0.018/fintech** all-in. See [[review-source-costs]].
- **Trustpilot** `blackfalcondata/trustpilot-reviews-scraper` mode `companyInfo` — $0.010/run.
- **Google Play** `automation-lab/google-play-scraper` mode `details` (score, ratings, histogram, `installs`) — $0.007/run.
- **App Store** `logiover/app-store-data-api` mode `ratings` (count + histogram; avg computed) — $0.001/run.
- Handlers: `lib/ingest/{types,handlers,trustpilot,googleplay,appstore}.ts` (KindHandler registry). Shared `Dist`/`distSentiment`/`distAverage` in `types.ts`.
- **Historical `reviews` table PURGED** (anonymization) — it stays empty; handlers store no reviews.

## Data in Neon

- **121 fintechs** (de-duped from 128 — removed 7 underscore duplicates; seed has a `DUP_SKIP` guard). `reviews` EMPTY. `metric_snapshots` = seeded monthly history + live points.
- **Coverage: 110/121 fintechs have ≥1 live source.** Trustpilot 90, Google Play 78, App Store 76; ~49 fully cross-platform. Insight surfaced: mobile ratings run higher than Trustpilot (Chime TP 3.5 vs GP 4.73 / AS 4.82).
- **~11 fintechs no live source** = long tail: generic-name neobanks (center, chip, cogni, imagin, varo_bank…) + HTX (no confident app match). Crypto exchanges (binance/bybit/gate/bitvavo/swissborg/bitcoin_suisse) were added manually via `scripts/ingest-crypto.ts`.
- Only ~2 days of live points so far (2026-07-05 review-era + 07-06 histogram). **Trends grow as the daily cron runs** — needs `APP_BASE_URL` (above).

## Profile page (redesigned + polished 2026-07-06)

`components/Profile.tsx` + `components/ui.tsx`. Structure: header (eyebrow category·country) → **cross-platform hero** (platform glyphs, rating, sentiment meter, Google Play installs, consensus line) → rating distribution (best source, TP→GP→AS fallback, per-star counts) + Trustpilot responsiveness → **live-only** volume chart (dates, gradient, endpoint callout; ≥2 live days) → **per-platform sentiment trend** (multi-line, auto-scaled) → company facts → about/FAQ. Dead sections removed (per-country, momentum tiles). Charts show **live data only** (`raw IS NOT NULL`), never seeded history.

## How to run (your own PowerShell — server dies when Claude's turn ends)

```powershell
cd C:\Users\PC\Documents\GitHub\neobase
npm run dev            # hot-reload at http://localhost:3000
```
Key pages: `/`, `/neobanks/`, `/fintech/revolut/`, `/exchange/binance/`, `/monitoring/`, `/sitemap.xml`, `/robots.txt`.

Pipeline / data commands:
```powershell
npm run apify:test -- <slug> [trustpilot|google_play|app_store]  # one live ingest (paid)
npm run apify:backfill -- <kind> <batch> [missing]               # bulk backfill (missing = only sources lacking today's snapshot)
npm run apify:appids [dry N]     # discover app ids via search (home-country storefront, domain-verified)
npm run apify:crypto             # manual crypto-exchange app ids + ingest
npm run apify:ids                # set the 6 original neobanks' store ids
npm run seed                     # reseed from _legacy/app.js (idempotent; skips DUP_SKIP)
npm run db:studio                # browse Neon
```

## Env (`.env`, gitignored)

`DATABASE_URL`, `APIFY_TOKEN`, `APIFY_TRUSTPILOT_ACTOR=blackfalcondata/trustpilot-reviews-scraper`, `APIFY_GOOGLE_PLAY_ACTOR=automation-lab/google-play-scraper`, `APIFY_APPSTORE_ACTOR=logiover/app-store-data-api`, `CRON_SECRET`, `APIFY_WEBHOOK_SECRET` — all set locally. `APP_BASE_URL` local=localhost. `ANTHROPIC_API_KEY`, Paddle — not filled. **On Vercel: same vars must be set for Production + Preview** (esp. `DATABASE_URL` + `APP_BASE_URL`). ⚠️ Neon+Apify secrets pasted in chat earlier — consider rotating.

## Product decisions

- **Anonymized aggregates only** — no individual reviews fetched or stored, ever (cost + PII). Sentiment from histograms. See [[no-review-text-on-site]].
- **Auto push+merge to `main` after each verified change** (no per-change confirmation) — see [[auto-push-merge]]. `main` is the Vercel prod branch. Merge via GitHub API `POST /repos/mateuszrz/neobase/merges` (no `gh` CLI; token from `git credential fill`).
- Later: gate live scraping to paid monitors (Paddle entitlements); scraping all 121 daily is the cost driver.

## Open threads / next steps

1. ⚠️ **Set `APP_BASE_URL` on Vercel prod** (above) — unblocks the daily cron so trends accrue. Highest priority.
2. **DataForSEO news source** — Google News for brand queries per market; ~$0.0006/request, $50 min deposit. Planned, NOT built. See [[news-source-dataforseo]].
3. **Long-tail coverage** — manually set app ids for any priority fintechs among the ~11 with no source (HTX, imagin, varo_bank, chip…).
4. **Sentiment drivers/topics — SHELVED.** No review text now (anonymized), so themes-from-text would reintroduce PII. Would need a separate source. See [[trustpilot-actor-no-topics]].
5. **Paid tier (later):** Auth.js, Paddle billing, Claude AI digests, per-org monitors.
6. **SEO polish:** hreflang (sitemap/robots done).

## Git / deploy

On `main`, deployed to Vercel production (green). This session's arc: histogram-only anonymized ingestion → dedupe → deploy fixes + re-import → sitemap/robots → full profile redesign + polish (cross-platform hero, live-only charts, per-platform sentiment trend). Auto push+merge active. `.env`/`_legacy` handled; no secrets committed.
