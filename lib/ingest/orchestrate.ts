/**
 * Cadence-aware kickoff orchestrator — the entry point both crons call.
 *
 * Two-tier collection:
 *  - weekly / public  → the free directory: all public sources, global (ZZ).
 *  - daily  / project → paid projects: chosen brands × markets (built later; no
 *                        project sources exist yet, so this is a no-op today).
 *
 * For each active source of the requested cadence it dispatches by kind: review
 * kinds start an Apify/mock run; crawl kinds enqueue a crawl_page job. Idempotency
 * is handled per-source by the underlying primitives.
 */

import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { SCRAPABLE_KINDS, startReviewSource, todayUtc } from "./kickoff";
import { enqueueCrawlSource } from "@/lib/crawl/kickoff";
import { CRAWL_KINDS } from "@/lib/crawl/types";
import { isSocialKind } from "@/lib/social/apify";
import { startSocialSource } from "@/lib/social/kickoff";

const { sources, fintechs } = schema;

export type Cadence = "weekly" | "daily";

export interface KickoffSummary {
  cadence: Cadence;
  reviews: number; // review sources kicked off
  crawls: number; // crawl sources enqueued
  social: number; // social runs started (LinkedIn/Facebook)
  skipped: number; // already-claimed / not runnable / unknown kind
}

export async function runKickoff(cadence: Cadence, day = todayUtc()): Promise<KickoffSummary> {
  const active = await db
    .select({
      id: sources.id,
      fintechId: sources.fintechId,
      kind: sources.kind,
      externalRef: sources.externalRef,
      country: sources.country,
      storeCountry: fintechs.country,
    })
    .from(sources)
    .innerJoin(fintechs, eq(fintechs.id, sources.fintechId))
    .where(and(eq(sources.cadence, cadence), eq(sources.active, true)));

  const summary: KickoffSummary = { cadence, reviews: 0, crawls: 0, social: 0, skipped: 0 };

  // Kick each source off. This used to be a sequential `for await` loop, which
  // for the ~600-source public fleet spent ~600 Apify `.start()` round-trips
  // back to back and blew past the 60s function limit — the tail of the fleet
  // simply never got kicked off and its snapshots went stale. Fire them in
  // bounded-concurrency waves so the whole fleet starts well within budget.
  type Bucket = "reviews" | "crawls" | "social" | "skipped";
  async function dispatch(s: (typeof active)[number]): Promise<Bucket> {
    if (SCRAPABLE_KINDS.includes(s.kind)) {
      // Project sources carry a real market in source.country → scrape that
      // storefront; public sources are global (ZZ) → use the fintech's home store.
      const storeCountry = s.country !== "ZZ" ? s.country : s.storeCountry;
      const r = await startReviewSource(
        { id: s.id, fintechId: s.fintechId, kind: s.kind, externalRef: s.externalRef, storeCountry },
        day,
      );
      return r === "enqueued" ? "reviews" : "skipped";
    }
    if ((CRAWL_KINDS as string[]).includes(s.kind)) {
      const r = await enqueueCrawlSource(
        { id: s.id, fintechId: s.fintechId, kind: s.kind, externalRef: s.externalRef, country: s.country },
        day,
      );
      return r === "enqueued" ? "crawls" : "skipped";
    }
    if (isSocialKind(s.kind)) {
      const r = await startSocialSource(
        { id: s.id, fintechId: s.fintechId, kind: s.kind, externalRef: s.externalRef },
        day,
      );
      return r === "enqueued" ? "social" : "skipped";
    }
    return "skipped";
  }

  const CONCURRENCY = 12;
  for (let i = 0; i < active.length; i += CONCURRENCY) {
    const buckets = await Promise.all(
      active.slice(i, i + CONCURRENCY).map((s) => dispatch(s).catch((): Bucket => "skipped")),
    );
    for (const b of buckets) summary[b]++;
  }

  return summary;
}
