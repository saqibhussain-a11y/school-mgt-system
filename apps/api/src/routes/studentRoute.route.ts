import { Router } from "express";
import { Role } from "@sms/db";
import { studentRouteService } from "../services/studentRoute.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { TRANSPORT_MANAGE_ROLES } from "./vehicle.route";
import { assignStudentRouteSchema } from "../validation/transport.schema";

async function assertCanViewStudentTransport(schoolId: string, user: { sub: string; role: string }, studentId: string) {
  if (TRANSPORT_MANAGE_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) return;
  if (user.role === Role.PARENT && (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))) {
    return;
  }
  throw new HttpError(403, "You do not have permission to view this transport assignment");
}

export const studentRouteRouter = Router();
studentRouteRouter.use(authenticate);

studentRouteRouter.get("/route/:routeId", authorize(...TRANSPORT_MANAGE_ROLES), async (req, res, next) => {
  try {
    res.json(await studentRouteService.listForRoute(req.user!.schoolId, req.params.routeId));
  } catch (err) {
    next(err);
  }
});

studentRouteRouter.get("/me", authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getByUserId(schoolId, req.user!.sub);
    if (!student) throw new HttpError(404, "No student profile linked to this account");
    res.json(await studentRouteService.getForStudent(schoolId, student.id));
  } catch (err) {
    next(err);
  }
});

studentRouteRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanViewStudentTransport(schoolId, req.user!, req.params.studentId);
    res.json(await studentRouteService.getForStudent(schoolId, req.params.studentId));
  } catch (err) {
    next(err);
  }
});

studentRouteRouter.post(
  "/",
  authorize(...TRANSPORT_MANAGE_ROLES),
  validateBody(assignStudentRouteSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await studentRouteService.assign(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

studentRouteRouter.delete("/student/:studentId", authorize(...TRANSPORT_MANAGE_ROLES), async (req, res, next) => {
  try {
    const removed = await studentRouteService.unassign(req.user!.schoolId, req.params.studentId);
    if (!removed) throw new HttpError(404, "This student has no route assignment");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
