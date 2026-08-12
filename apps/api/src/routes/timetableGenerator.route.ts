import { Router } from "express";
import { Role } from "@sms/db";
import { timetableGenerationQueue } from "../lib/queue";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const timetableGeneratorRouter = Router();

// Runs as a background job (see lib/queue.ts / lib/worker.ts) rather than
// inline — up to 5 greedy scheduling passes over every section/subject/
// period/day combination is real CPU-bound work that would otherwise block
// the event loop for every tenant, not just the one generating.
timetableGeneratorRouter.post(
  "/generate",
  authenticate,
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const classId = req.body?.classId as string | undefined;
      const job = await timetableGenerationQueue.add("generate", { schoolId: req.user!.schoolId, classId });
      res.status(202).json({ jobId: job.id });
    } catch (err) {
      next(err);
    }
  },
);

timetableGeneratorRouter.get(
  "/generate/:jobId",
  authenticate,
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const job = await timetableGenerationQueue.getJob(req.params.jobId);
      // 404, not 403 — a job ID from another school shouldn't even confirm
      // that a job with that ID exists.
      if (!job || job.data.schoolId !== req.user!.schoolId) {
        throw new HttpError(404, "Job not found");
      }

      const state = await job.getState();
      if (state === "completed") {
        res.json({ state, result: job.returnvalue });
      } else if (state === "failed") {
        res.json({ state, error: job.failedReason ?? "Timetable generation failed" });
      } else {
        res.json({ state });
      }
    } catch (err) {
      next(err);
    }
  },
);
