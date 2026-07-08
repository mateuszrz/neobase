/**
 * Processes one `crawl_page` job: fetch a page, extract its canonical structure,
 * store a daily content_snapshot (idempotent), and — when the structure differs
 * from the prior snapshot for this source — record a content_change with a human
 * summary of what moved.
 *
 * Mock mode (no ANTHROPIC key, or mock flag) skips fetch+Claude and uses the
 * deterministic extractor so the whole flow runs offline and still produces a
 * detectable week-over-week change.
 */

import { and, desc, eq, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { isClaudeLive } from "@/lib/anthropic";
import { fetchPage } from "./fetch";
import { extract, contentHash } from "./extract";
import { diffExtracted, summarizeChange } from "./diff";
import { EMPTY_EXTRACTED, isCrawlKind, type Extracted } from "./types";
import { ingestBlogPage } from "@/lib/blog/ingest";

const { contentSnapshots, contentChanges } = schema;

export interface CrawlPayload {
  sourceId: string;
  fintechId: string;
  kind: string; // must be a CrawlKind
  country?: string;
  url: string;
  snapshotDate: string; // YYYY-MM-DD
  mock?: boolean;
}

export interface CrawlResult {
  snapshotsWritten: number;
  changesWritten: number;
  changed: boolean;
  via: string;
}

/** Most recent snapshot for this source strictly before `before`. */
async function priorSnapshot(sourceId: string, country: string, before: string) {
  const [row] = await db
    .select({
      id: contentSnapshots.id,
      snapshotDate: contentSnapshots.snapshotDate,
      contentHash: contentSnapshots.contentHash,
      extracted: contentSnapshots.extracted,
    })
    .from(contentSnapshots)
    .where(
      and(
        eq(contentSnapshots.sourceId, sourceId),
        eq(contentSnapshots.country, country),
        lt(contentSnapshots.snapshotDate, before),
      ),
    )
    .orderBy(desc(contentSnapshots.snapshotDate))
    .limit(1);
  return row ?? null;
}

export async function processCrawlJob(p: CrawlPayload): Promise<CrawlResult> {
  if (!isCrawlKind(p.kind)) throw new Error(`not a crawl kind: "${p.kind}"`);
  const country = p.country ?? "ZZ";
  const useMock = p.mock ?? !isClaudeLive();

  // Blogs are a post-list content type, not a pricing/plans page — extract the
  // recent posts into blog_posts instead of a snapshot/diff. (Skips in mock so no
  // fabricated posts are stored; the profile shows the render-time sample.)
  if (p.kind === "blog") {
    const res = await ingestBlogPage(p.fintechId, p.url, { mock: useMock });
    return { snapshotsWritten: 0, changesWritten: res.upserted, changed: res.upserted > 0, via: res.via };
  }

  // 1. Retrieve page text (skipped in mock — extraction is synthetic).
  let httpStatus: number | null = null;
  let rawText: string | null = null;
  let via = "mock";
  if (!useMock) {
    const page = await fetchPage(p.url);
    httpStatus = page.status;
    rawText = page.text || null;
    via = page.via;
  }

  // 2. Extract canonical structure + hash it.
  const extracted: Extracted = await extract({
    text: rawText ?? "",
    kind: p.kind,
    url: p.url,
    seed: p.sourceId,
    snapshotDate: p.snapshotDate,
    mock: useMock,
  });
  const hash = contentHash(extracted);

  // 3. Upsert today's snapshot (idempotent per source+country+day).
  const [snap] = await db
    .insert(contentSnapshots)
    .values({
      sourceId: p.sourceId,
      fintechId: p.fintechId,
      kind: p.kind,
      country,
      snapshotDate: p.snapshotDate,
      url: p.url,
      httpStatus,
      fetchedVia: via,
      contentHash: hash,
      extracted,
      rawText,
    })
    .onConflictDoUpdate({
      target: [contentSnapshots.sourceId, contentSnapshots.country, contentSnapshots.snapshotDate],
      set: { contentHash: hash, extracted, rawText, httpStatus, fetchedVia: via, url: p.url },
    })
    .returning({ id: contentSnapshots.id });

  // 4. Detect change vs the prior snapshot; record it if the structure moved.
  const prior = await priorSnapshot(p.sourceId, country, p.snapshotDate);
  let changesWritten = 0;
  let changed = false;

  if (prior && prior.contentHash !== hash) {
    changed = true;
    const prev = (prior.extracted as Extracted) ?? EMPTY_EXTRACTED;
    const diff = diffExtracted(prev, extracted);
    const { changeKinds, summary } = await summarizeChange(prev, extracted, diff, { mock: useMock });

    const written = await db
      .insert(contentChanges)
      .values({
        fintechId: p.fintechId,
        kind: p.kind,
        country,
        sourceId: p.sourceId,
        fromSnapshotId: prior.id,
        toSnapshotId: snap.id,
        fromDate: prior.snapshotDate,
        toDate: p.snapshotDate,
        changeKinds,
        diff,
        summary,
      })
      // One change row per new snapshot — re-processing the same day is a no-op.
      .onConflictDoNothing({ target: contentChanges.toSnapshotId })
      .returning({ id: contentChanges.id });
    changesWritten = written.length;
  }

  return { snapshotsWritten: 1, changesWritten, changed, via };
}
