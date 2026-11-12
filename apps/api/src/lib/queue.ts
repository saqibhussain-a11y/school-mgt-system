import { Queue } from "bullmq";
import { redis } from "./redis";
import { env } from "../config/env";
import type { timetableGeneratorService } from "../services/timetableGenerator.service";

export interface TimetableGenerationJobData {
  schoolId: string;
  classId?: string;
}

// Derived from the service's own return type rather than hand-duplicated —
// the service already returns different shapes depending on the early-exit
// path (no sections/no periods vs. a full run), so keeping one source of
// truth avoids the two silently drifting apart.
export type TimetableGenerationJobResult = Awaited<ReturnType<typeof timetableGeneratorService.generate>>;

// Greedy timetable generation runs up to 5 full passes over every
// section/subject/period/day combination — genuinely CPU-bound work that,
// run inline in a request handler, blocks the single Node event loop for
// every tenant, not just the one generating. Everything else this
// performance pass looked at synchronously (exam-datesheet generation,
// report CSV/PDF export) turned out to be a bounded queue-shift/row-count
// operation on inspection — fast enough that a job queue would be pure
// overhead, so only this one moved. This was re-verified for
// resultCardPdf.ts specifically (a later review flagged its per-student
// PDFKit page rendering as a possible blocking risk): benchmarked against
// the largest seeded class (249 students, FULL mode with image
// compositing) at ~110ms total — still comfortably in the "sync is fine"
// category, not moved to a queue.
export const timetableGenerationQueue = new Queue<TimetableGenerationJobData, TimetableGenerationJobResult>(
  "timetable-generation",
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { age: 3600 },
      removeOnFail: { age: 86_400 },
    },
  },
);

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export const emailQueue = new Queue<EmailJobData>("email", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 7 * 86_400 },
  },
});

export async function queueEmails(emails: EmailJobData[]) {
  // Tests run without the worker, so queued jobs would pile up and later be
  // sent by a dev server to throwaway test addresses.
  if (env.nodeEnv === "test" || emails.length === 0) return;
  await emailQueue.addBulk(emails.map((data) => ({ name: "send", data })));
}

export const scheduledTasksQueue = new Queue("scheduled-tasks", {
  connection: redis,
  defaultJobOptions: { removeOnComplete: { count: 50 }, removeOnFail: { count: 50 } },
});

export async function closeQueues() {
  await Promise.all([timetableGenerationQueue.close(), emailQueue.close(), scheduledTasksQueue.close()]);
}
