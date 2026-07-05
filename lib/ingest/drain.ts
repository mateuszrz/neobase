/**
 * Drains a bounded number of queued jobs. Called every minute by Vercel Cron.
 * Each job processes one dataset page; if more pages remain the job re-enqueues
 * itself with an advanced offset so no single invocation risks the function
 * timeout.
 */

import { claimJobs, completeJob, failJob, rescheduleJob } from "@/lib/queue";
import { processDatasetJob, type ProcessPayload } from "./process";

export interface DrainSummary {
  claimed: number;
  completed: number;
  rescheduled: number;
  failed: number;
  reviewsUpserted: number;
  snapshotsWritten: number;
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
  };

  for (const job of jobs) {
    try {
      if (job.type !== "process_dataset") throw new Error(`unknown job type: ${job.type}`);
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
    } catch (err) {
      await failJob(job, err);
      summary.failed++;
    }
  }

  return summary;
}
