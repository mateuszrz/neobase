# NeoBase — Session handoff (resume here)

_Last worked: 2026-07-05/06. Branch: `feat/saas-mvp` (not pushed, not merged to main)._

## What NeoBase is now

Rebuilding the old static `neobase.co` SPA into a **fintech competitive-intelligence SaaS**:
1. **Public directory** (free, SEO) — neobanks + crypto exchanges, ratings/sentiment/trends.
2. **Paid monitoring panel** (later) — buy a country + competitors, daily data + Claude AI digests, billed via Paddle.

Full plan: `C:\Users\PC\.claude\plans\merry-cuddling-hollerith.md`.

## Stack (decided + live)

- **Next.js 16 (App Router)** on Vercel · **Neon Postgres** via Drizzle (HTTP driver) · **Claude API** (AI, later) · **Paddle** (billing, later).
- **Apify** for scraping. Trustpilot actor: `blackfalcondata/trustpilot-reviews-scraper` (LIVE, paid, working).
- Orchestration: **Vercel Cron + webhooks + Postgres `job_queue`** (no Inngest).
- Design system: **`DESIGN.md`** ("Seline" — warm paper, cyan accent, Inter/Inter Tight). Frontend follows it.

## Done this session

- **Phase 1 — data pipeline (complete, verified):** repo restructured to Next.js (old files in `_legacy/`); Drizzle schema + migration; seed from `_legacy/app.js` (128 fintechs + monthly snapshot history); cron→queue→process pipeline, idempotent; **live Trustpilot ingestion working** (real reviews, TrustScore, lifetime count, per-country segmentation).
- **Only newest reviews:** daily scrape uses `sort=recency` + `lookbackDays=3` + `maxResults=500` (see `trustpilotDailyInput()`), never full history.
- **Phase 2 — public frontend (Seline):** home, `/neobanks` (country filter), `/exchanges`, profile pages (SSG, 128 pre-rendered), `/about`, `/monitoring` (Paddle pricing teaser).
- **Analytical neobank profile (per product direction):**
  - **No individual review text shown** (reviews scraped for sentiment only).
  - Ratings + review-volume chart, **sentiment-over-time** chart, change tiles (Δ).
  - Company facts panel; per-country sentiment.
  - **Rating distribution (1–5★)** + **company responsiveness** (reply rate/time, verified %) from `metric_snapshots.raw` — populated live for Revolut.
  - `aiSummary` + `topics` wired but the actor returned them empty this run (section auto-hides).

## Data currently in Neon

- `fintechs` 128 · `sources` 512 · `metric_snapshots` ~4.6k (seeded monthly history + live Revolut) · `reviews` ~580 (Revolut live only) · `ingest_runs`/`job_queue` clean.
- Only **Revolut** has live Trustpilot data + `raw` extras. Other fintechs have seeded monthly history only.

## How to run (do this first in the morning)

Open your own PowerShell (server dies when Claude's turn ends):
```powershell
cd C:\Users\PC\Documents\GitHub\neobase
npm run start          # serves the production build at http://localhost:3000
# or: npm run dev      # hot-reload
```
Pages: `/`, `/neobanks/`, `/fintech/revolut/`, `/exchange/binance/`, `/monitoring/`.

Other commands:
```powershell
npm run seed                 # reseed fintechs from _legacy/app.js (idempotent)
npm run db:studio            # browse Neon tables
npm run apify:test -- revolut   # full live Trustpilot ingest for one fintech (paid Apify)
npm run apify:probe -- revolut.com   # inspect actor output shape
npm run pipeline:kickoff / :drain    # run the mock/live daily pipeline locally
npm run db:migrate           # apply Drizzle migrations
```

## Secrets / env (`.env`, gitignored — NOT in repo)

`DATABASE_URL` (Neon), `APIFY_TOKEN` + `APIFY_TRUSTPILOT_ACTOR` (set), `CRON_SECRET`, `APIFY_WEBHOOK_SECRET`. `ANTHROPIC_API_KEY` (Claude — paid, not yet filled), Paddle keys (not yet). ⚠️ The Neon + Apify secrets were pasted in chat earlier — consider rotating.

## Product decisions to remember

- **Only scrape newest reviews** (cost + relevance).
- **Never display individual review text** — aggregate ratings/sentiment/trends only.
- Scraping the full 128 daily = cost; later gate live scraping to **paid monitors only** (Paddle entitlements).

## Open threads / next steps (pick up here)

1. **Finish visual review of the profile** — confirm rating-distribution + responsiveness render nicely at `/fintech/revolut/` (build passed; last live render-check was inconclusive due to server timing — just open it).
2. **Sentiment drivers/topics:** this actor returned `topics`/`aiSummary` empty. Check its input options (maybe a flag/paid feature) or derive themes another way.
3. **Backfill live data for more fintechs** (currently only Revolut) so the directory isn't mostly seeded history — or decide which markets to prioritise.
4. **Decide what else to scrape:** Google Play, App Store, financial media, brand SERPs (was deferred — "potem zastanowimy się co scrapować").
5. Later phases: dynamic `sitemap.ts`/`robots.ts` + hreflang; Auth.js; Paddle; Claude AI digests; deploy (Vercel preview → neobase.co).

## Git

Branch `feat/saas-mvp`. Commits: MVP pipeline → newest-reviews → Seline frontend → analytical profile → rating-distribution/responsiveness. Nothing pushed. `.env` and `_legacy/` design file handled; no secrets committed.
