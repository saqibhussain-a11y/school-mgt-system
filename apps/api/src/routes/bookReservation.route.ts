import { Router } from "express";
import { Role } from "@sms/db";
import { bookReservationService } from "../services/bookReservation.service";
import { studentService } from "../services/student.service";
import { studentGuardianService } from "../services/studentGuardian.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { LIBRARY_MANAGE_ROLES } from "./libraryBook.route";
import { createReservationSchema } from "../validation/library.schema";

async function assertCanActForStudent(schoolId: string, user: { sub: string; role: string }, studentId: string) {
  if (LIBRARY_MANAGE_ROLES.includes(user.role as Role)) return;
  if (user.role === Role.STUDENT && (await studentService.isOwnStudent(schoolId, user.sub, studentId))) return;
  if (user.role === Role.PARENT && (await studentGuardianService.isGuardianOfStudent(schoolId, user.sub, studentId))) {
    return;
  }
  throw new HttpError(403, "You do not have permission to manage this reservation");
}

export const bookReservationRouter = Router();
bookReservationRouter.use(authenticate);

bookReservationRouter.get("/", authorize(...LIBRARY_MANAGE_ROLES), async (req, res, next) => {
  try {
    const { bookId, status } = req.query as { bookId?: string; status?: string };
    res.json(await bookReservationService.list(req.user!.schoolId, { bookId, status }));
  } catch (err) {
    next(err);
  }
});

bookReservationRouter.get("/me", authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const student = await studentService.getByUserId(schoolId, req.user!.sub);
    if (!student) throw new HttpError(404, "No student profile linked to this account");
    res.json(await bookReservationService.list(schoolId, { studentId: student.id }));
  } catch (err) {
    next(err);
  }
});

bookReservationRouter.get("/student/:studentId", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanActForStudent(schoolId, req.user!, req.params.studentId);
    res.json(await bookReservationService.list(schoolId, { studentId: req.params.studentId }));
  } catch (err) {
    next(err);
  }
});

bookReservationRouter.post("/", validateBody(createReservationSchema), async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    await assertCanActForStudent(schoolId, req.user!, req.body.studentId);
    res.status(201).json(await bookReservationService.create(schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

bookReservationRouter.post("/:id/cancel", async (req, res, next) => {
  try {
    const schoolId = req.user!.schoolId;
    const reservation = await bookReservationService.getById(schoolId, req.params.id);
    if (!reservation) throw new HttpError(404, "Reservation not found");
    await assertCanActForStudent(schoolId, req.user!, reservation.studentId);
    res.json(await bookReservationService.cancel(schoolId, req.params.id));
  } catch (err) {
    next(err);
  }
});
