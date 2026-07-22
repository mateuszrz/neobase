/**
 * Drains a bounded number of queued jobs. Called by Vercel Cron.
 *
 * Dispatches by job type:
 *  - process_dataset: one review-dataset page (re-enqueues itself if more pages).
 *  - crawl_page: fetch → extract → snapshot → diff (single-shot, no pagination).
 *
 * Each invocation is bounded so no single run risks the function timeout.
 */

import { claimJobs, completeJob, failJob, rescheduleJob } from "@/lib/queue";
import { processDatasetJob, type ProcessPayload } from "./process";
import { processCrawlJob, type CrawlPayload } from "@/lib/crawl/process";
import { processSocialDataset, type SocialPayload } from "@/lib/social/process";

export interface DrainSummary {
  claimed: number;
  completed: number;
  rescheduled: number;
  failed: number;
  reviewsUpserted: number;
  snapshotsWritten: number;
  contentSnapshots: number;
  contentChanges: number;
  socialPosts: number;
}

async function runJob(job: Awaited<ReturnType<typeof claimJobs>>[number], summary: DrainSummary): Promise<void> {
  try {
    if (job.type === "process_dataset") {
      const payload = job.payload as unknown as ProcessPayload;
      const res = await processDatasetJob(payload);
      summary.reviewsUpserted += res.reviewsUpserted;
      summary.snapshotsWritten += res.snapshotsWritten;
      if (res.done) {
        await completeJob(job.id);
        summary.completed++;
      } else {
        await rescheduleJob(job.id, { ...payload, offset: res.nextOffset });
        summary.rescheduled++;
      }
    } else if (job.type === "crawl_page") {
      const payload = job.payload as unknown as CrawlPayload;
      const res = await processCrawlJob(payload);
      summary.contentSnapshots += res.snapshotsWritten;
      summary.contentChanges += res.changesWritten;
      await completeJob(job.id);
      summary.completed++;
    } else if (job.type === "collect_social") {
      const payload = job.payload as unknown as SocialPayload;
      const res = await processSocialDataset(payload);
      summary.socialPosts += res.upserted;
      await completeJob(job.id);
      summary.completed++;
    } else {
      throw new Error(`unknown job type: ${job.type}`);
    }
  } catch (err) {
    await failJob(job, err);
    summary.failed++;
  }
}

/**
 * Drain queued jobs until the queue is empty, a hard cap is hit, or the time
 * budget runs out — whichever comes first.
 *
 * Was a single sequential pass of 20 jobs per run: with ~600 review datasets
 * queued after a weekly kickoff, a once-daily drain of 20 would take a month to
 * clear, so most sources never got a fresh snapshot inside the 14-day window.
 * Now it claims and processes in bounded-concurrency waves, and only claims what
 * it will actually process (so nothing is left claimed-but-unprocessed on exit),
 * letting one run inside the 60s function limit chew through the whole backlog.
 */
export async function drainQueue(maxJobs = 600, budgetMs = 50_000, concurrency = 8): Promise<DrainSummary> {
  const start = Date.now();
  const summary: DrainSummary = {
    claimed: 0,
    completed: 0,
    rescheduled: 0,
    failed: 0,
    reviewsUpserted: 0,
    snapshotsWritten: 0,
    contentSnapshots: 0,
    contentChanges: 0,
    socialPosts: 0,
  };

  while (summary.claimed < maxJobs && Date.now() - start < budgetMs) {
    const jobs = await claimJobs(Math.min(concurrency, maxJobs - summary.claimed));
    if (!jobs.length) break; // queue drained
    summary.claimed += jobs.length;
    await Promise.all(jobs.map((job) => runJob(job, summary)));
  }

  return summary;
}
