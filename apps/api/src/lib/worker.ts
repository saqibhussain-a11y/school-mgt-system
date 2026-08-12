import { Worker } from "bullmq";
import { redis } from "./redis";
import { logger } from "./logger";
import { timetableGeneratorService } from "../services/timetableGenerator.service";
import type { TimetableGenerationJobData, TimetableGenerationJobResult } from "./queue";

// A separate duplicated connection, not the shared `redis` client — BullMQ's
// Worker issues blocking commands (BRPOPLPUSH) that would otherwise stall
// every other Redis call (cache reads, Queue.add) sharing the connection.
// Run in-process rather than as a standalone worker script: this app has no
// existing multi-process deployment story, and a second process to build,
// deploy, and keep alive would be a much bigger change than the actual
// problem (one CPU-bound endpoint) calls for.
const workerConnection = redis.duplicate();

let timetableWorker: Worker<TimetableGenerationJobData, TimetableGenerationJobResult> | undefined;

export function startWorkers() {
  timetableWorker = new Worker<TimetableGenerationJobData, TimetableGenerationJobResult>(
    "timetable-generation",
    async (job) => {
      const { schoolId, classId } = job.data;
      return timetableGeneratorService.generate(schoolId, { classId });
    },
    { connection: workerConnection, concurrency: 2 },
  );

  timetableWorker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id, schoolId: job?.data.schoolId }, "Timetable generation job failed");
  });
}

export async function closeWorkers() {
  await timetableWorker?.close();
  await workerConnection.quit();
}
