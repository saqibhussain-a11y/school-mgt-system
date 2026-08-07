import { Router } from "express";
import { Role } from "@sms/db";
import { roomService } from "../services/room.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createRoomSchema, updateRoomSchema } from "../validation/room.schema";

const ADMIN_ROLES = [Role.SUPER_ADMIN, Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const roomRouter = Router();

roomRouter.use(authenticate);

roomRouter.get("/", async (req, res, next) => {
  try {
    res.json(await roomService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

roomRouter.get("/:id", async (req, res, next) => {
  try {
    const room = await roomService.getById(req.user!.schoolId, req.params.id);
    if (!room) throw new HttpError(404, "Room not found");
    res.json(room);
  } catch (err) {
    next(err);
  }
});

roomRouter.post("/", authorize(...ADMIN_ROLES), validateBody(createRoomSchema), async (req, res, next) => {
  try {
    res.status(201).json(await roomService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

roomRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateRoomSchema),
  async (req, res, next) => {
    try {
      const room = await roomService.update(req.user!.schoolId, req.params.id, req.body);
      if (!room) throw new HttpError(404, "Room not found");
      res.json(room);
    } catch (err) {
      next(err);
    }
  },
);

roomRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const room = await roomService.remove(req.user!.schoolId, req.params.id);
    if (!room) throw new HttpError(404, "Room not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
