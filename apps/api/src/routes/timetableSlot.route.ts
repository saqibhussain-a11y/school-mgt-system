import { Router } from "express";
import { Role } from "@sms/db";
import { timetableSlotService } from "../services/timetableSlot.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import {
  createTimetableSlotSchema,
  updateTimetableSlotSchema,
} from "../validation/timetableSlot.schema";

const ADMIN_ROLES: Role[] = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const timetableSlotRouter = Router();

timetableSlotRouter.use(authenticate);

// Open to any authenticated role, same as Class/Section/Subject GETs — a
// weekly schedule isn't sensitive the way attendance/grades are.
timetableSlotRouter.get("/", async (req, res, next) => {
  try {
    const { sectionId, staffId, roomId } = req.query as {
      sectionId?: string;
      staffId?: string;
      roomId?: string;
    };
    if (!sectionId && !staffId && !roomId) {
      throw new HttpError(400, "sectionId, staffId, or roomId query param is required");
    }
    const schoolId = req.user!.schoolId;
    res.json(
      sectionId
        ? await timetableSlotService.listForSection(schoolId, sectionId)
        : staffId
          ? await timetableSlotService.listForStaff(schoolId, staffId)
          : await timetableSlotService.listForRoom(schoolId, roomId!),
    );
  } catch (err) {
    next(err);
  }
});

timetableSlotRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createTimetableSlotSchema),
  async (req, res, next) => {
    try {
      const slot = await timetableSlotService.create(req.user!.schoolId, req.body);
      res.status(201).json(slot);
    } catch (err) {
      next(err);
    }
  },
);

timetableSlotRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateTimetableSlotSchema),
  async (req, res, next) => {
    try {
      const slot = await timetableSlotService.update(req.user!.schoolId, req.params.id, req.body);
      if (!slot) throw new HttpError(404, "Timetable slot not found");
      res.json(slot);
    } catch (err) {
      next(err);
    }
  },
);

timetableSlotRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const slot = await timetableSlotService.remove(req.user!.schoolId, req.params.id);
    if (!slot) throw new HttpError(404, "Timetable slot not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
