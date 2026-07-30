import { Router } from "express";
import { Role } from "@sms/db";
import { authenticate } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import { staffService } from "../services/staff.service";
import { teacherAssignmentService } from "../services/teacherAssignment.service";
import { HttpError } from "../middleware/errorHandler";

export const meRouter = Router();

meRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await userService.findById(req.user!.sub);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    next(err);
  }
});

// Lets a teacher's own UI (attendance marking, student filters) restrict
// itself to their assigned class/sections without needing admin rights.
meRouter.get("/assignments", authenticate, async (req, res, next) => {
  try {
    if (req.user!.role !== Role.TEACHER) {
      res.json([]);
      return;
    }
    const schoolId = req.user!.schoolId;
    const staff = await staffService.getByUserId(schoolId, req.user!.sub);
    res.json(staff ? await teacherAssignmentService.listForStaff(schoolId, staff.id) : []);
  } catch (err) {
    next(err);
  }
});
