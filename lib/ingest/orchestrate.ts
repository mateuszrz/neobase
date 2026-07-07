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

const { sources, fintechs } = schema;

export type Cadence = "weekly" | "daily";

export interface KickoffSummary {
  cadence: Cadence;
  reviews: number; // review sources kicked off
  crawls: number; // crawl sources enqueued
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

  const summary: KickoffSummary = { cadence, reviews: 0, crawls: 0, skipped: 0 };

  for (const s of active) {
    if (SCRAPABLE_KINDS.includes(s.kind)) {
      // Project sources carry a real market in source.country → scrape that
      // storefront; public sources are global (ZZ) → use the fintech's home store.
      const storeCountry = s.country !== "ZZ" ? s.country : s.storeCountry;
      const r = await startReviewSource(
        { id: s.id, fintechId: s.fintechId, kind: s.kind, externalRef: s.externalRef, storeCountry },
        day,
      );
      r === "enqueued" ? summary.reviews++ : summary.skipped++;
    } else if ((CRAWL_KINDS as string[]).includes(s.kind)) {
      const r = await enqueueCrawlSource(
        { id: s.id, fintechId: s.fintechId, kind: s.kind, externalRef: s.externalRef, country: s.country },
        day,
      );
      r === "enqueued" ? summary.crawls++ : summary.skipped++;
    } else {
      summary.skipped++;
    }
  }

  return summary;
}
