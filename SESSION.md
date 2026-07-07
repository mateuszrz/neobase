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
npm run seed                     # reseed from scripts/seed-data/app.js (idempotent; skips DUP_SKIP)
npm run db:studio                # browse Neon
```

## Env (`.env`, gitignored)

`DATABASE_URL`, `APIFY_TOKEN`, `APIFY_TRUSTPILOT_ACTOR=blackfalcondata/trustpilot-reviews-scraper`, `APIFY_GOOGLE_PLAY_ACTOR=automation-lab/google-play-scraper`, `APIFY_APPSTORE_ACTOR=logiover/app-store-data-api`, `CRON_SECRET`, `APIFY_WEBHOOK_SECRET` — all set locally. `APP_BASE_URL` local=localhost. `ANTHROPIC_API_KEY`, Paddle — not filled. **On Vercel: same vars must be set for Production + Preview** (esp. `DATABASE_URL` + `APP_BASE_URL`). ⚠️ Neon+Apify secrets pasted in chat earlier — consider rotating.

## Product decisions

- **Anonymized aggregates only** — no individual reviews fetched or stored, ever (cost + PII). Sentiment from histograms. See [[no-review-text-on-site]].
- **Auto push+merge to `main` after each verified change** (no per-change confirmation) — see [[auto-push-merge]]. `main` is the Vercel prod branch. Merge via GitHub API `POST /repos/mateuszrz/neobase/merges` (no `gh` CLI; token from `git credential fill`).
- Later: gate live scraping to paid monitors (Paddle entitlements); scraping all 121 daily is the cost driver.

## Content intelligence — crawl + week-over-week diff (NEW, 2026-07-07)

First data type of the SaaS expansion (5 planned: pages/social/news/blog/store). **Merged to main.**
- **Model:** two-tier data collection — **public = global (ZZ), weekly**; **paid project = chosen markets, daily** (projects/billing NOT built yet). This crawl engine is the public/weekly page tier.
- **Fetch:** free server `fetch()` → **Apify `website-content-crawler` fallback only on empty/blocked** (`lib/crawl/fetch.ts`). Claude never fetches.
- **Claude:** extracts canonical `{plans, prices, features, offers, fees}` (structured outputs `messages.parse`+zod) and summarises the change. Model `ANTHROPIC_CRAWL_MODEL` (default `claude-opus-4-8`; **Haiku 4.5** is the cheaper high-volume pick). **Mock path** (no key) runs the whole flow offline + produces a detectable change.
- **Tables:** `content_snapshots` (hash of extracted + raw_text) + `content_changes` (structural diff + human summary). Migration `0001` applied to Neon. `metric_snapshots` unchanged (numbers); content is separate (structure/diff).
- **Pipeline:** `crawl_page` job type in `job_queue`, dispatched in `lib/ingest/drain.ts` beside `process_dataset`. Scripts: `crawl:seed` (homepage from `fintechs.website`), `crawl:test -- <slug> [kind]` (2 dates, shows the week-over-week change), `db:apply` (non-TTY migration apply).

## Collection tracks split (two-tier crons, 2026-07-07)

`sources.scope` (public|project) + `sources.cadence` (weekly|daily) added (migration `0002`; existing 484 sources backfilled to **public/weekly**). One cadence-aware orchestrator `lib/ingest/orchestrate.ts` → `runKickoff(cadence)` selects active sources of that cadence and dispatches by kind (review kinds → Apify/mock via `startReviewSource`; crawl kinds → `enqueueCrawlSource`).
- **Crons (replaced `daily-kickoff` + `weekly-crawl`):** `/api/cron/weekly-public` (Mon 03:00 → public/weekly: 266 active review sources + crawl) · `/api/cron/daily-project` (03:00 daily → project/daily: **0 today**, inert until projects exist) · `/api/cron/drain-queue` (04:00).
- **Behaviour change:** public reviews now collect **weekly** (was daily). Verified in mock: daily=all-zeros; weekly selects 266 review sources (homepage crawl sources are inactive → 0 until activated). `pipeline:kickoff [weekly|daily]` runs a cadence locally.
- ⚠️ **Drain throughput:** drain is 20 jobs/day at `0 4 * * *`; a weekly burst of ~266+ jobs won't clear in one day. When going live, raise drain frequency (if the Vercel plan allows sub-daily crons) and/or `maxJobs`.
- **Go-live checklist (not done):** 1) set `ANTHROPIC_API_KEY` on Vercel; 2) `npm run crawl:seed`; 3) one live `crawl:test` on a real page to validate fetch+Claude; 4) discover pricing/offer/blog URLs (only homepage seeded). DataForSEO stays reserved for **news** (not www crawl).

## SaaS foundation — projects + packages + Paddle (NEW, 2026-07-07)

Makes the daily-project track real: a subscribed user's project generates the daily sources. **Merged to main.**
- **Data model (migration `0003`, applied):** Auth.js Drizzle-adapter tables (`users`/`accounts`/`sessions`/`verification_tokens`) + `subscriptions` (Paddle) + `projects` + `project_brands` + `project_markets`.
- **Packages** (`lib/packages.ts`): 3 tiers — Starter 3 brands·1 market, Growth 6·3, Pro 10·5. Paddle price ids from env `PADDLE_PRICE_{STARTER,GROWTH,PRO}`.
- **Shared-source model:** a project declares brands × markets; it does NOT own scrapers. `lib/projects/reconcile.ts` maintains the UNION of desired (fintech × market × kind) across all entitled projects as active `scope='project', cadence='daily'` sources (revolut/DE scraped once for all projects). `setWhere scope='project'` guard never hijacks a public row. Orphans → `active=false`. Project kinds today: trustpilot/google_play/app_store/homepage (social/news/blog later).
- **Per-market storefront:** orchestrate now uses `source.country` as the store market for project sources (public stays fintech home country).
- **Service** (`lib/projects/service.ts`): createProject / setBrands / setMarkets enforce package slot limits vs the user's active/trialing subscription, then reconcile.
- **Paddle** (`lib/paddle/`, `@paddle/paddle-node-sdk`): webhook `/api/webhooks/paddle` verifies signature → syncs `subscription.*` events (customData.userId + price id → package) into `subscriptions` → reconcile. Manual mode (no key): `upsertSubscription()` activates a sub for testing. `PADDLE_ENV` sandbox|production.
- **Verified:** `tsc` + `next build` clean; `npm run project:demo` runs the full vertical (user→Pro sub→project 3 brands×2 markets→**24 shared daily sources**→daily-project would fire 24) and self-cleans (prod left at 0 daily sources). No jobs enqueued against prod.
- **Next slices:** 1) **Auth.js magic-link** (tables ready; needs email sender + Next 16 compat check) so real users log in; 2) wire **live Paddle keys** + price ids + checkout UI; 3) project management UI (`/panel`); 4) monthly report generation (Claude digest over shared data).

## Auth — magic-link sign-in (NEW, 2026-07-07)

Passwordless login so real users can own projects. **Merged to main.**
- **Auth.js v5** (`next-auth@5.0.0-beta.31`, supports Next 16) + `@auth/drizzle-adapter` mapped onto the existing `users`/`accounts`/`sessions`/`verification_tokens` tables. Database session strategy. `lib/auth/index.ts` exports `handlers`/`auth`/`signIn`/`signOut`; route `/api/auth/[...nextauth]` (nodejs runtime); `trustHost: true`.
- **Email delivery** (`lib/auth/email-provider.ts`): magic link sent via **Resend HTTP API** when `RESEND_API_KEY` set, else **logged to the server console** (dev) — usable now with no email account.
- **Pages:** `/login` (email → magic link, server action `signIn`), `/login/verify` (check inbox), `/panel` (gated by `auth()`; shows email + subscription/package + projects; `signOut`). Seline styling.
- **Verified live:** Drizzle adapter round-trip (createUser→token→session→delete) clean; `next build` clean; **full magic-link E2E** against a running dev server — signin → link (console) → callback (200, session) → `/panel` renders the logged-in user; `/panel` unauth → redirects to `/login`.
- ⚠️ **`trailingSlash: true`** adds a 308 hop on auth POSTs — browsers follow it (verified E2E), harmless.
- ⚠️ **DO FIRST on Vercel:** set **`AUTH_SECRET`** (else `/login` + `/panel` 500 at runtime). For real emails set `RESEND_API_KEY` + verified `EMAIL_FROM` domain (else links only print to server logs). Rest of the site is unaffected.
- **Next:** project-management UI on `/panel` (create project, pick brands/markets → calls `lib/projects/service`); live Paddle keys + checkout; monthly report generation.

## Public page — social + news sections (NEW, 2026-07-07)

Fintech profile now has **"In the media"** (news) and **"Latest from social"** (LinkedIn/Facebook) sections. **Merged to main.**
- **Tables:** `social_posts` + `news_items` (public brand/press content — allowed, unlike user reviews).
- **Sample-first, honest:** when no real data exists, the query returns a **deterministic sample generated at render time (never stored)**, and the UI shows a **"Sample" pill**. Real data (Apify social / DataForSEO news) replaces it automatically — so prod is never misleading.
- **Modules:** `lib/social/{sample,apify}.ts`, `lib/news/{sample,dataforseo}.ts`, shared `lib/rng.ts`. Queries `getSocialPosts`/`getNews` (real→sample fallback). UI `SocialFeed`/`NewsList` in `components/ui.tsx`; sections in `Profile.tsx`.
- **Live path wired, dormant:** social via Apify (`APIFY_LINKEDIN_ACTOR`/`APIFY_FACEBOOK_ACTOR` + a handle in `fintechs.socials`); news via DataForSEO (`DATAFORSEO_LOGIN`/`PASSWORD`). Go live per-fintech: `npm run social:test -- <slug> linkedin`, `npm run news:test -- <slug> <query> <country>`.
- **Not yet:** wire social/news into the weekly-public cron (needs handle/query discovery); derive news sentiment (Claude); DataForSEO account/credentials ($50 min deposit — none yet).
- **Verified:** tsc + next build; prerendered /fintech/revolut renders both sections with sample content + Sample pills.

## AI weekly brief (NEW, 2026-07-08)

Profile now leads with an **"✦ AI brief"** card — a short narrative synthesised from recent news + rating/sentiment moves, refreshed weekly. **Merged to main.**
- **Table `ai_summaries`** (one row per fintech/kind, weekly upsert). Modules `lib/summary/{compose,generate}.ts`.
- **Sample-first:** `getAiSummary` returns the stored brief if generated, else a deterministic composed preview grounded in **real ratings/sentiment + the same sample news** shown below, labelled "Sample".
- **Generation:** `generateSummary(fintechId)` gathers context (avg rating, sentiment direction, recent news) → Claude when `ANTHROPIC_API_KEY` set, else the deterministic composer (still factual). `npm run summary:generate -- <slug>|all`.
- **Verified:** tsc + next build; prerendered /fintech/revolut shows the brief (e.g. "Revolut holds a cross-platform rating of 4.8/5 … coverage is largely positive …").
- **Weekly auto-refresh — go-live:** run `summary:generate -- all` on a weekly cron *after* data collection (add `/api/cron/weekly-briefs`, or fold into the weekly-public flow). Needs `ANTHROPIC_API_KEY` for real Claude briefs (else composed).

## Open threads / next steps

1. ⚠️ **Set `APP_BASE_URL` on Vercel prod** (above) — unblocks the daily cron so trends accrue. Highest priority.
2. **DataForSEO news source** — Google News for brand queries per market; ~$0.0006/request, $50 min deposit. Planned, NOT built. See [[news-source-dataforseo]].
3. **Long-tail coverage** — manually set app ids for any priority fintechs among the ~11 with no source (HTX, imagin, varo_bank, chip…).
4. **Sentiment drivers/topics — SHELVED.** No review text now (anonymized), so themes-from-text would reintroduce PII. Would need a separate source. See [[trustpilot-actor-no-topics]].
5. **Paid tier (later):** Auth.js, Paddle billing, Claude AI digests, per-org monitors.
6. **SEO polish:** hreflang (sitemap/robots done).

## Git / deploy

On `main`, deployed to Vercel production (green). This session's arc: histogram-only anonymized ingestion → dedupe → deploy fixes + re-import → sitemap/robots → full profile redesign + polish (cross-platform hero, live-only charts, per-platform sentiment trend). Auto push+merge active. `.env`/`_legacy` handled; no secrets committed.
