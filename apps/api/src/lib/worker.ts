import { Worker } from "bullmq";
import { redis } from "./redis";
import { logger } from "./logger";
import { sendMail } from "./mailer";
import { timetableGeneratorService } from "../services/timetableGenerator.service";
import { staffAttendanceService } from "../services/staffAttendance.service";
import { scheduledTasksQueue, type EmailJobData, type TimetableGenerationJobData, type TimetableGenerationJobResult } from "./queue";

// A separate duplicated connection, not the shared `redis` client — BullMQ's
// Worker issues blocking commands (BRPOPLPUSH) that would otherwise stall
// every other Redis call (cache reads, Queue.add) sharing the connection.
// Run in-process rather than as a standalone worker script: this app has no
// existing multi-process deployment story, and a second process to build,
// deploy, and keep alive would be a much bigger change than the actual
// problem (one CPU-bound endpoint) calls for.
const workerConnection = redis.duplicate();

let timetableWorker: Worker<TimetableGenerationJobData, TimetableGenerationJobResult> | undefined;
let emailWorker: Worker<EmailJobData> | undefined;
let scheduledWorker: Worker | undefined;

const CHECK_OUT_REMINDER_JOB = "check-out-reminders";

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

  emailWorker = new Worker<EmailJobData>(
    "email",
    async (job) => {
      await sendMail(job.data.to, job.data.subject, job.data.html);
    },
    { connection: workerConnection, concurrency: 5 },
  );
  emailWorker.on("failed", (job, err) => {
    logger.error({ err, jobId: job?.id, attempts: job?.attemptsMade }, "Email job failed");
  });

  scheduledWorker = new Worker(
    "scheduled-tasks",
    async (job) => {
      if (job.name === CHECK_OUT_REMINDER_JOB) return staffAttendanceService.sendCheckOutReminders();
    },
    { connection: workerConnection, concurrency: 1 },
  );
  scheduledWorker.on("failed", (job, err) => {
    logger.error({ err, job: job?.name }, "Scheduled task failed");
  });

  // Upserted by id, so restarts and multiple API instances share one schedule.
  scheduledTasksQueue
    .upsertJobScheduler(CHECK_OUT_REMINDER_JOB, { every: 5 * 60 * 1000 }, { name: CHECK_OUT_REMINDER_JOB })
    .catch((err) => logger.error({ err }, "Failed to schedule check-out reminders"));
}

export async function closeWorkers() {
  await Promise.all([timetableWorker?.close(), emailWorker?.close(), scheduledWorker?.close()]);
  await workerConnection.quit();
}
