import { Queue } from "bullmq";
import { redis } from "./redis";
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
// overhead, so only this one moved.
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

export async function closeQueues() {
  await timetableGenerationQueue.close();
}
