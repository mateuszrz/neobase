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

export interface DrainSummary {
  claimed: number;
  completed: number;
  rescheduled: number;
  failed: number;
  reviewsUpserted: number;
  snapshotsWritten: number;
  contentSnapshots: number;
  contentChanges: number;
}

export async function drainQueue(maxJobs = 20): Promise<DrainSummary> {
  const jobs = await claimJobs(maxJobs);
  const summary: DrainSummary = {
    claimed: jobs.length,
    completed: 0,
    rescheduled: 0,
    failed: 0,
    reviewsUpserted: 0,
    snapshotsWritten: 0,
    contentSnapshots: 0,
    contentChanges: 0,
  };

  for (const job of jobs) {
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
      } else {
        throw new Error(`unknown job type: ${job.type}`);
      }
    } catch (err) {
      await failJob(job, err);
      summary.failed++;
    }
  }

  return summary;
}
