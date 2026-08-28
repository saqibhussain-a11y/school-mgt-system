import { Router } from "express";
import { Role } from "@sms/db";
import { roomColumnService } from "../services/roomColumn.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createRoomColumnSchema, updateRoomColumnSchema } from "../validation/roomColumn.schema";

const ADMIN_ROLES = [Role.SCHOOL_ADMIN, Role.PRINCIPAL];

export const roomColumnRouter = Router();
roomColumnRouter.use(authenticate);

roomColumnRouter.get("/", async (req, res, next) => {
  try {
    const roomId = req.query.roomId as string | undefined;
    if (!roomId) throw new HttpError(400, "roomId is required");
    res.json(await roomColumnService.list(req.user!.schoolId, roomId));
  } catch (err) {
    next(err);
  }
});

roomColumnRouter.post(
  "/",
  authorize(...ADMIN_ROLES),
  validateBody(createRoomColumnSchema),
  async (req, res, next) => {
    try {
      res.status(201).json(await roomColumnService.create(req.user!.schoolId, req.body));
    } catch (err) {
      next(err);
    }
  },
);

roomColumnRouter.patch(
  "/:id",
  authorize(...ADMIN_ROLES),
  validateBody(updateRoomColumnSchema),
  async (req, res, next) => {
    try {
      const column = await roomColumnService.update(req.user!.schoolId, req.params.id, req.body);
      if (!column) throw new HttpError(404, "Room column not found");
      res.json(column);
    } catch (err) {
      next(err);
    }
  },
);

roomColumnRouter.delete("/:id", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const column = await roomColumnService.remove(req.user!.schoolId, req.params.id);
    if (!column) throw new HttpError(404, "Room column not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
