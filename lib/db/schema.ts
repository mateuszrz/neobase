/**
 * Drizzle schema for the NeoBase intelligence platform.
 *
 * Phase 1 (MVP) tables only. SaaS/billing/AI tables (orgs, subscriptions,
 * monitors, digests, media_mentions, offer_snapshots, ...) land in later phases.
 *
 * Design notes:
 *  - `country` uses char(2) with 'ZZ' as the sentinel for "global / unsegmented"
 *    so UNIQUE constraints behave (Postgres treats NULLs as distinct).
 *  - Every ingest write targets a natural-key UNIQUE so re-processing a dataset
 *    is idempotent (cron + webhooks both double-fire).
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  char,
  integer,
  bigint,
  bigserial,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uuid,
  smallint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Directory ──────────────────────────────────────────────────────────────

export const fintechs = pgTable(
  "fintechs",
  {
    id: text("id").primaryKey(), // app.js slug, e.g. "revolut" — stable SEO URL
    type: text("type").notNull().default("neobank"), // neobank | exchange
    name: text("name").notNull(),
    country: char("country", { length: 2 }), // ISO2 of HQ/origin, nullable for exchanges
    logoSvg: text("logo_svg"),
    color: text("color"),
    website: text("website"),
    founded: integer("founded"),
    headquarters: text("headquarters"),
    employees: integer("employees"),
    valuationUsd: bigint("valuation_usd", { mode: "number" }),
    // Two distinct things that used to share one column (see drizzle/0016):
    //  status    — lifecycle: "active" | "acquired" | "ceased"
    //  ownership — who owns it: "Private", "Public (NASDAQ: PYPL)", "Subsidiary (Block Inc.)"
    status: text("status"),
    ownership: text("ownership"),
    description: text("description"),
    about: text("about"),
    tags: text("tags").array(),
    availableIn: char("available_in", { length: 2 }).array(),
    // Low-churn structured blobs kept as JSON for now.
    licenses: jsonb("licenses"),
    // Per-field trust gate: { <field>: "high" | "low" }. Facts are only rendered
    // when marked "high" — we never show data we aren't confident is correct.
    factConfidence: jsonb("fact_confidence"),
    socials: jsonb("socials"),
    keyPeople: jsonb("key_people"),
    investors: jsonb("investors"),
    subsidiaries: jsonb("subsidiaries"),
    history: jsonb("history"),
    faqs: jsonb("faqs"),
    // MiCA/ESMA CASP registry match (nullable; null = not found in the register).
    caspProviderId: bigint("casp_provider_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("fintechs_country_idx").on(t.country), index("fintechs_type_idx").on(t.type)],
);

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // trustpilot | google_play | app_store | serp | homepage | offer_page | social_*
    externalRef: text("external_ref").notNull(), // url / app-id / handle / trustpilot domain
    country: char("country", { length: 2 }).notNull().default("ZZ"),
    // Two-tier collection: public directory data is global + weekly; paid-project
    // data is per-market + daily. Cadence drives which cron kicks a source off;
    // scope tags who it serves (entitlements/reporting).
    scope: text("scope").notNull().default("public"), // public | project
    cadence: text("cadence").notNull().default("weekly"), // weekly | daily
    apifyActorId: text("apify_actor_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sources_natural_key").on(t.fintechId, t.kind, t.externalRef, t.country),
    index("sources_fintech_idx").on(t.fintechId),
    index("sources_active_kind_idx").on(t.active, t.kind),
    // Primary kickoff query: active sources for a given cadence.
    index("sources_cadence_idx").on(t.cadence, t.active),
  ],
);

// ─── Time-series core ───────────────────────────────────────────────────────

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    fintechId: text("fintech_id").notNull(), // denormalised for fast reads
    kind: text("kind").notNull(), // denormalised source.kind
    country: char("country", { length: 2 }).notNull().default("ZZ"),
    snapshotDate: date("snapshot_date").notNull(),
    rating: numeric("rating", { precision: 3, scale: 2 }),
    reviewCount: bigint("review_count", { mode: "number" }),
    reviewCountDelta: bigint("review_count_delta", { mode: "number" }),
    sentimentPos: numeric("sentiment_pos", { precision: 4, scale: 1 }),
    sentimentNeg: numeric("sentiment_neg", { precision: 4, scale: 1 }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotency: one row per (source, country, day).
    uniqueIndex("metric_snapshots_natural_key").on(t.sourceId, t.country, t.snapshotDate),
    // Primary read path: a fintech's series for a platform.
    index("metric_snapshots_series_idx").on(t.fintechId, t.kind, t.country, t.snapshotDate),
  ],
);

export const reviews = pgTable(
  "reviews",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    fintechId: text("fintech_id").notNull(),
    country: char("country", { length: 2 }).notNull().default("ZZ"), // reviewer origin
    externalId: text("external_id").notNull(),
    rating: smallint("rating"),
    title: text("title"),
    body: text("body"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    sentimentLabel: text("sentiment_label"), // positive | neutral | negative
    sentimentScore: numeric("sentiment_score", { precision: 4, scale: 3 }),
    sentimentModel: text("sentiment_model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reviews_natural_key").on(t.sourceId, t.externalId),
    index("reviews_fintech_idx").on(t.fintechId, t.postedAt),
    // Cheap "today's batch to classify".
    index("reviews_unclassified_idx").on(t.id).where(sql`${t.sentimentLabel} is null`),
  ],
);

// ─── Content intelligence (crawl + diff) ────────────────────────────────────
// Unlike metric_snapshots (numeric aggregates), these capture PAGE CONTENT for
// week-over-week change detection: homepage/pricing/offer/blog. A snapshot stores
// the Claude-extracted canonical structure (plans/prices/features) plus a hash of
// it; when the hash differs from the prior snapshot we record a content_change
// with a human summary of what moved (price up, new feature, dropped offer…).

export const contentSnapshots = pgTable(
  "content_snapshots",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    fintechId: text("fintech_id").notNull(), // denormalised for fast reads
    kind: text("kind").notNull(), // homepage | pricing_page | offer_page | blog
    country: char("country", { length: 2 }).notNull().default("ZZ"),
    snapshotDate: date("snapshot_date").notNull(),
    url: text("url").notNull(),
    httpStatus: integer("http_status"),
    fetchedVia: text("fetched_via"), // fetch | apify | mock
    // sha256 of the canonicalised `extracted` blob — cheap change detection that
    // ignores cosmetic HTML noise (only meaningful structure changes flip it).
    contentHash: text("content_hash").notNull(),
    extracted: jsonb("extracted"), // { pageType, headline, plans[], features[], offers[], fees[] }
    rawText: text("raw_text"), // cleaned main text (audit / re-extraction)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Idempotency: one capture per (source, country, day).
    uniqueIndex("content_snapshots_natural_key").on(t.sourceId, t.country, t.snapshotDate),
    index("content_snapshots_series_idx").on(t.fintechId, t.kind, t.country, t.snapshotDate),
  ],
);

export const contentChanges = pgTable(
  "content_changes",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id").notNull(),
    kind: text("kind").notNull(),
    country: char("country", { length: 2 }).notNull().default("ZZ"),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    fromSnapshotId: bigint("from_snapshot_id", { mode: "number" }), // null on first-ever capture
    toSnapshotId: bigint("to_snapshot_id", { mode: "number" }).notNull(),
    fromDate: date("from_date"),
    toDate: date("to_date").notNull(),
    changeKinds: text("change_kinds").array(), // price | feature | offer | copy
    diff: jsonb("diff"), // { added, removed, changed } structural delta
    summary: text("summary"), // Claude's human-readable "what changed"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One change row per new snapshot — re-processing the same day writes nothing new.
    uniqueIndex("content_changes_to_snapshot_key").on(t.toSnapshotId),
    index("content_changes_feed_idx").on(t.fintechId, t.toDate),
  ],
);

// ─── Accounts & auth (Auth.js Drizzle adapter schema) ───────────────────────
// Standard shape expected by @auth/drizzle-adapter so magic-link auth is drop-in
// in the next slice. Ids are text/UUID strings (adapter default).

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [uniqueIndex("accounts_provider_key").on(t.provider, t.providerAccountId)],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("verification_tokens_key").on(t.identifier, t.token)],
);

// ─── Billing (Paddle) ───────────────────────────────────────────────────────

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    packageId: text("package_id").notNull(), // starter | growth | pro (see lib/packages)
    status: text("status").notNull().default("active"), // active | trialing | past_due | canceled
    paddleSubscriptionId: text("paddle_subscription_id"),
    paddleCustomerId: text("paddle_customer_id"),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_user_idx").on(t.userId),
    uniqueIndex("subscriptions_paddle_key").on(t.paddleSubscriptionId),
  ],
);

// ─── Projects (monitoring scopes a customer buys) ───────────────────────────
// A project declares WHICH brands × markets to track; it does not own scrapers.
// The reconciler maintains the union of desired coverage as active daily sources.

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId)],
);

export const projectBrands = pgTable(
  "project_brands",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("project_brands_key").on(t.projectId, t.fintechId)],
);

export const projectMarkets = pgTable(
  "project_markets",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    country: char("country", { length: 2 }).notNull(), // ISO2 market
  },
  (t) => [uniqueIndex("project_markets_key").on(t.projectId, t.country)],
);

// ─── Public content: social + news ──────────────────────────────────────────
// Companies' own public posts and press coverage — public brand content (not
// user reviews), so surfacing headlines/snippets is consistent with the
// no-review-text rule. Content, not histograms.

export const socialPosts = pgTable(
  "social_posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    network: text("network").notNull(), // linkedin | facebook
    externalId: text("external_id").notNull(),
    url: text("url"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    text: text("text"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("social_posts_natural_key").on(t.fintechId, t.network, t.externalId),
    index("social_posts_feed_idx").on(t.fintechId, t.postedAt),
  ],
);

export const newsItems = pgTable(
  "news_items",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    country: char("country", { length: 2 }).notNull().default("ZZ"), // market of the brand query
    externalId: text("external_id").notNull(),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    title: text("title").notNull(),
    publisher: text("publisher"),
    snippet: text("snippet"),
    sentiment: text("sentiment"), // positive | neutral | negative (derived later)
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("news_items_natural_key").on(t.fintechId, t.externalId),
    index("news_items_feed_idx").on(t.fintechId, t.publishedAt),
  ],
);

// Companies' own blog/newsroom posts — public marketing content (like social),
// so surfacing titles/snippets is consistent with the no-review-text rule.
// Collected by crawling each fintech's blog (crawl `blog` kind) and extracting
// the recent post list; the profile shows a render-time sample until then.
export const blogPosts = pgTable(
  "blog_posts",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    url: text("url"),
    title: text("title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    snippet: text("snippet"),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_natural_key").on(t.fintechId, t.externalId),
    index("blog_posts_feed_idx").on(t.fintechId, t.publishedAt),
  ],
);

// Translated prose for a directory entry. English is NOT stored here — it stays
// canonical in `fintechs` and is never written by the translator, so a bad
// translation can never damage the source of truth.
//
// Visibility is still decided by `fintechs.fact_confidence`, which is about the
// FACT, not the language: if the English description didn't clear the trust
// gate, no language shows it.
export const fintechTranslations = pgTable(
  "fintech_translations",
  {
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    description: text("description"),
    about: text("about"),
    faqs: jsonb("faqs"),
    translatedAt: timestamp("translated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("fintech_translations_key").on(t.fintechId, t.locale)],
);

// OUR OWN editorial articles — written in /panel/blog, one row per language.
// Distinct from `blog_posts` above, which is crawled third-party content bound
// to a fintech; these belong to NeoBase and stand alone.
//
// Language versions are independent by design: a post may exist only in Polish
// (e.g. about the KNF) with no English counterpart, so there is no "translation
// group" linking rows — `locale` + `slug` is the whole identity, and slugs are
// written in each language.
export const articles = pgTable(
  "articles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    locale: text("locale").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    bodyMd: text("body_md").notNull().default(""),
    coverUrl: text("cover_url"),
    author: text("author"),
    tags: text("tags").array(),
    status: text("status").notNull().default("draft"), // draft | published
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_locale_slug").on(t.locale, t.slug),
    index("articles_feed_idx").on(t.locale, t.status, t.publishedAt),
  ],
);

// Third-party MENTIONS — public posts by OTHER people about the brand, found by
// searching each network for the brand (name / @handle). Distinct from social_posts
// (the brand's own posts): here the author is a third party. Public social-listening
// content, like news. Collected via search actors (X / LinkedIn / Facebook); the
// profile shows a render-time sample until the live search runs.
export const mentions = pgTable(
  "mentions",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    network: text("network").notNull(), // x | linkedin | facebook
    externalId: text("external_id").notNull(),
    url: text("url"),
    authorName: text("author_name"),
    authorHandle: text("author_handle"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    text: text("text"),
    likes: integer("likes"),
    comments: integer("comments"),
    shares: integer("shares"),
    sentiment: text("sentiment"), // positive | neutral | negative toward the brand (derived)
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("mentions_natural_key").on(t.fintechId, t.network, t.externalId),
    index("mentions_feed_idx").on(t.fintechId, t.postedAt),
  ],
);

// ─── Composite sentiment index ──────────────────────────────────────────────
// Our own weekly sentiment score per fintech: blends review sentiment (Trustpilot
// + app stores, from the rating histogram) with news-article sentiment (Claude-
// derived), each weighted by its data volume (evidence-based). One row per
// (fintech, week) — the weekly job upserts it; the profile shows the score, the
// week-over-week change and the trend.
export const sentimentIndex = pgTable(
  "sentiment_index",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    week: date("week").notNull(), // reference date for the week
    composite: numeric("composite", { precision: 5, scale: 2 }).notNull(), // 0–100
    reviewScore: numeric("review_score", { precision: 5, scale: 2 }),
    newsScore: numeric("news_score", { precision: 5, scale: 2 }),
    mentionScore: numeric("mention_score", { precision: 5, scale: 2 }),
    trendScore: numeric("trend_score", { precision: 5, scale: 2 }), // WoW 1–2★ review-share momentum (50=flat)
    reviewVolume: bigint("review_volume", { mode: "number" }),
    newsVolume: integer("news_volume"),
    mentionVolume: integer("mention_volume"),
    reviewWeight: numeric("review_weight", { precision: 4, scale: 3 }),
    newsWeight: numeric("news_weight", { precision: 4, scale: 3 }),
    mentionWeight: numeric("mention_weight", { precision: 4, scale: 3 }),
    trendWeight: numeric("trend_weight", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("sentiment_index_key").on(t.fintechId, t.week)],
);

// ─── MiCA / ESMA CASP registry ──────────────────────────────────────────────
// The EU register of crypto-asset service providers licensed under MiCA (from
// ESMA, ~280 rows). Seeded from a CSV; powers the "MiCA licence" panel on
// exchange profiles and (later) a searchable public registry page.
export const caspProviders = pgTable(
  "casp_providers",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    provider: text("provider").notNull(), // brand / provider name
    legalEntity: text("legal_entity"),
    country: text("country").notNull(), // country of the licence
    regulator: text("regulator").notNull(), // national competent authority (e.g. BaFin)
    services: text("services").array(), // MiCA services (Custody, Trading platform, …)
    website: text("website"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("casp_providers_key").on(t.provider, t.country),
    index("casp_providers_country_idx").on(t.country),
  ],
);

// ─── AI weekly brief ────────────────────────────────────────────────────────
// A short Claude-written narrative per fintech, refreshed weekly from recent news
// + rating/sentiment moves. One current row per (fintech, kind) — the weekly job
// upserts it. The public page shows a labelled render-time sample until generated.

export const aiSummaries = pgTable(
  "ai_summaries",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    fintechId: text("fintech_id")
      .notNull()
      .references(() => fintechs.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("weekly_brief"),
    summary: text("summary").notNull(),
    generatedFor: date("generated_for"), // the week this brief covers
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ai_summaries_key").on(t.fintechId, t.kind)],
);

// ─── Pipeline plumbing ──────────────────────────────────────────────────────

export const ingestRuns = pgTable(
  "ingest_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    runKey: text("run_key").notNull().unique(), // sha256(actor + batch + YYYY-MM-DD)
    actor: text("actor").notNull(),
    apifyRunId: text("apify_run_id"),
    datasetId: text("dataset_id"),
    status: text("status").notNull().default("started"), // started | succeeded | failed
    stats: jsonb("stats"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("ingest_runs_status_idx").on(t.status)],
);

export const jobQueue = pgTable(
  "job_queue",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(), // process_dataset | ...
    payload: jsonb("payload").notNull().default({}),
    status: text("status").notNull().default("pending"), // pending | processing | done | failed
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_queue_claim_idx").on(t.status, t.runAfter)],
);

// ─── Free "test our reports" lead magnet ─────────────────────────────────────
// A public form (brand + competitor domains) generates a weekly competitive-
// intelligence report, grounded in the tracked-fintech data we already hold.
// The executive summary is shown free; the full report is unlocked by email —
// this row IS the captured lead. `report` holds the generated structured JSON.

export const reportRequests = pgTable(
  "report_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brand: text("brand").notNull(), // raw typed brand, e.g. "ZEN.COM"
    competitors: text("competitors").array().notNull().default(sql`ARRAY[]::text[]`), // raw typed competitor domains/names
    brandFintechId: text("brand_fintech_id"), // matched tracked fintech (null = not tracked yet)
    matchedIds: text("matched_ids").array().notNull().default(sql`ARRAY[]::text[]`), // all matched fintech ids
    report: jsonb("report").notNull(), // generated structured report (see lib/report/types)
    model: text("model"), // claude model id, or "composed" for the deterministic fallback
    email: text("email"), // captured on unlock (null until then)
    ip: text("ip"), // requester IP (from x-forwarded-for) — for abuse rate-limiting
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("report_requests_created_idx").on(t.createdAt), index("report_requests_ip_idx").on(t.ip, t.createdAt)],
);

// Per-project monthly intelligence report (Claude digest over the shared daily
// data for the project's brands × markets). One row per (project, period end);
// regenerating the same day upserts. Shown in the panel; refreshed by a cron.
export const projectReports = pgTable(
  "project_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    periodDays: integer("period_days").notNull().default(30),
    generatedFor: date("generated_for").notNull(), // period-end date (upsert key)
    report: jsonb("report").notNull(),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("project_reports_key").on(t.projectId, t.generatedFor)],
);

export type Fintech = typeof fintechs.$inferSelect;
export type NewFintech = typeof fintechs.$inferInsert;
export type Source = typeof sources.$inferSelect;
export type MetricSnapshot = typeof metricSnapshots.$inferSelect;
export type ContentSnapshot = typeof contentSnapshots.$inferSelect;
export type NewContentSnapshot = typeof contentSnapshots.$inferInsert;
export type ContentChange = typeof contentChanges.$inferSelect;
export type User = typeof users.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type SocialPost = typeof socialPosts.$inferSelect;
export type NewsItem = typeof newsItems.$inferSelect;
export type BlogPost = typeof blogPosts.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ReportRequest = typeof reportRequests.$inferSelect;
export type SentimentIndexRow = typeof sentimentIndex.$inferSelect;
export type JobRow = typeof jobQueue.$inferSelect;
