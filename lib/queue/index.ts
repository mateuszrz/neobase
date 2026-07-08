/**
 * Minimal Postgres-backed job queue.
 *
 * Replaces a durable-execution service (Inngest) under the "Vercel Cron +
 * webhooks only" constraint. Claiming uses a single atomic
 * `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` statement so it is
 * safe when multiple `drain-queue` cron invocations overlap, and works over the
 * Neon HTTP driver (no interactive transaction needed).
 */

import { sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const { jobQueue } = schema;

export type JobType = "process_dataset" | "crawl_page" | "collect_social";

export interface EnqueueInput {
  type: JobType;
  payload: Record<string, unknown>;
  runAfter?: Date;
}

export async function enqueue(job: EnqueueInput): Promise<void> {
  await db.insert(jobQueue).values({
    type: job.type,
    payload: job.payload,
    runAfter: job.runAfter ?? new Date(),
  });
}

export interface ClaimedJob {
  id: number;
  type: JobType;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/** Atomically claim up to `limit` runnable jobs (pending, or stuck > 5 min). */
export async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  const rows = await db.execute(sql`
    UPDATE job_queue
    SET status = 'processing', locked_at = now(), attempts = attempts + 1, updated_at = now()
    WHERE id IN (
      SELECT id FROM job_queue
      WHERE (status = 'pending' AND run_after <= now())
         OR (status = 'processing' AND locked_at < now() - interval '5 minutes')
      ORDER BY run_after
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    RETURNING id, type, payload, attempts, max_attempts
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    type: r.type,
    payload: r.payload ?? {},
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
  }));
}

export async function completeJob(id: number): Promise<void> {
  await db.execute(sql`
    UPDATE job_queue SET status = 'done', locked_at = NULL, updated_at = now() WHERE id = ${id}
  `);
}

/** Re-schedule a job with a copy of (mutated) payload, keeping the same row. */
export async function rescheduleJob(id: number, payload: Record<string, unknown>): Promise<void> {
  await db.execute(sql`
    UPDATE job_queue
    SET status = 'pending', locked_at = NULL, payload = ${JSON.stringify(payload)}::jsonb,
        run_after = now(), updated_at = now()
    WHERE id = ${id}
  `);
}

/** Fail with exponential backoff, or park permanently after maxAttempts. */
export async function failJob(job: ClaimedJob, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  if (job.attempts >= job.maxAttempts) {
    await db.execute(sql`
      UPDATE job_queue SET status = 'failed', last_error = ${message}, locked_at = NULL, updated_at = now()
      WHERE id = ${job.id}
    `);
    return;
  }
  const backoffSec = Math.min(3600, 2 ** job.attempts * 30);
  await db.execute(sql`
    UPDATE job_queue
    SET status = 'pending', last_error = ${message}, locked_at = NULL,
        run_after = now() + (${backoffSec} * interval '1 second'), updated_at = now()
    WHERE id = ${job.id}
  `);
}
