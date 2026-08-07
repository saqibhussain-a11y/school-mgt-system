import { Router } from "express";
import { Role } from "@sms/db";
import { timetableGeneratorService } from "../services/timetableGenerator.service";
import { authenticate, authorize } from "../middleware/auth.middleware";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const timetableGeneratorRouter = Router();

timetableGeneratorRouter.post(
  "/generate",
  authenticate,
  authorize(...ADMIN_ROLES),
  async (req, res, next) => {
    try {
      const classId = req.body?.classId as string | undefined;
      const result = await timetableGeneratorService.generate(req.user!.schoolId, { classId });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
