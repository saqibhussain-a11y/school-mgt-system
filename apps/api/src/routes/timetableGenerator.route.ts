import { Router } from "express";
import { Role } from "@sms/db";
import { timetableGenerationQueue } from "../lib/queue";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { HttpError } from "../middleware/errorHandler";

const ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const timetableGeneratorRouter = Router();

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
