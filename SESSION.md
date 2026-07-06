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
- **Ingestion is now HISTOGRAM-ONLY (2026-07-06): no individual reviews, no PII, ~$0.018/fintech.** Every source returns only the anonymized aggregate (rating + total count + 1–5★ histogram); sentiment derived from the histogram (lifetime, stable). Trustpilot `companyInfo`, Google Play `details`, App Store `logiover/app-store-data-api` `ratings`. See [[review-source-costs]]. Trade-off: no per-country segmentation going forward (existing per-country rows are stale history).
- **6 neobanks carry all 3 platforms** (Revolut, Monzo, N26, Wise, Chime, Bunq) with cross-platform tiles. Insight: mobile ratings run higher than Trustpilot (Chime TP 3.5 vs GP 4.73 / AS 4.82).
- **6 neobanks have live Trustpilot data** (backfilled 2026-07-06): Revolut, Monzo, N26, Wise, Chime, Bunq. ZZ TrustScores: Revolut 4.7, Wise 4.30, N26 4.10, Bunq 4.10, Monzo 4.60, Chime 3.50; lifetime counts 13k–294k; rich per-country breakdowns (Wise 39 countries, N26 12). Backfill cost: 4 new runs = **$0.30** total (Wise $0.22 — 39 countries = more compute). **All 6 have `raw` extras** (rating distribution + responsiveness) — `includeCompanyInfo:true` populates them on every daily run, so all 6 profiles show the analytical sections, not just Revolut. Other ~122 fintechs have seeded monthly history only.

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

`DATABASE_URL` (Neon), `APIFY_TOKEN` + `APIFY_TRUSTPILOT_ACTOR` + `APIFY_GOOGLE_PLAY_ACTOR` + `APIFY_APPSTORE_ACTOR` (all set), `CRON_SECRET`, `APIFY_WEBHOOK_SECRET`. `ANTHROPIC_API_KEY` (Claude — paid, not yet filled), Paddle keys (not yet). ⚠️ The Neon + Apify secrets were pasted in chat earlier — consider rotating.

## Product decisions to remember

- **Only scrape newest reviews** (cost + relevance).
- **Never display individual review text** — aggregate ratings/sentiment/trends only.
- Scraping the full 128 daily = cost; later gate live scraping to **paid monitors only** (Paddle entitlements).

## Open threads / next steps (pick up here)

1. **Finish visual review of the profile** — confirm rating-distribution + responsiveness render nicely at `/fintech/revolut/` (build passed; last live render-check was inconclusive due to server timing — just open it).
2. **Sentiment drivers/topics — DIAGNOSED, DEFERRED.** Root cause: the actor does **not** emit per-review `topics` (the `topics` *input* is a category *filter*, not output), and `aiSummary` only appears "when available" (absent for Revolut). So `normalizeLiveItem`'s `item.topics` maps a non-existent field → tally always empty → section auto-hides. To ship this we must derive themes ourselves from review text (aggregate only, no raw text shown). Reviews are **multilingual** (PL/IT/EN…), so an English keyword lexicon is weak — the real fix is **Claude-based extraction at ingest** (needs `ANTHROPIC_API_KEY`, ~pennies/fintech), aligning with the paid-tier "AI digests" vision. **Deferred by product decision** (2026-07-06) until the Claude tier is built. Dead `topics` mapping left in place (harmless — always empty).
3. **Backfill live data — top 6 neobanks DONE** (Revolut, Monzo, N26, Wise, Chime, Bunq; $0.30 for the 4 new runs; all 6 have full `raw` extras). Next: extend to more fintechs/markets (crypto exchanges are still all seeded), or decide priority markets.
4. **Additional sources:**
   - **Google Play + App Store — BUILT & LIVE (2026-07-06).** Pipeline generalized to a `KindHandler` registry (`lib/ingest/{types,handlers,googleplay,appstore}.ts`); `automation-lab/google-play-scraper` + `automation-lab/apple-app-store-scraper` in `details` mode (GP $0.007/run, AS ~$0.05/run). `npm run apify:test -- <slug> google_play|app_store`; `npm run apify:ids` sets store app ids. Only the 6 live neobanks activated — extend by adding app ids to `scripts/set-app-ids.ts`. See [[review-source-costs]].
   - **News (Google News, brand queries per market) via DataForSEO** — planned separate provider (not Apify); ~$0.0006/request (standard queue), $50 min deposit. NOT built. See [[news-source-dataforseo]].
   - Trustpilot dominates the bill (~$1.29/1k, ~13× mobile). All sources: aggregate only, never show raw text.
5. Later phases: dynamic `sitemap.ts`/`robots.ts` + hreflang; Auth.js; Paddle; Claude AI digests; deploy (Vercel preview → neobase.co).

## Git

Branch `feat/saas-mvp`. Commits: MVP pipeline → newest-reviews → Seline frontend → analytical profile → rating-distribution/responsiveness. Nothing pushed. `.env` and `_legacy/` design file handled; no secrets committed.
