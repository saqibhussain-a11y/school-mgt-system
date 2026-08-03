import { Router } from "express";
import { Role } from "@sms/db";
import { vehicleService } from "../services/vehicle.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { createVehicleSchema, updateVehicleSchema } from "../validation/transport.schema";

export const TRANSPORT_MANAGE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.SCHOOL_ADMIN,
  Role.PRINCIPAL,
  Role.TRANSPORT_MANAGER,
];

export const vehicleRouter = Router();
vehicleRouter.use(authenticate, authorize(...TRANSPORT_MANAGE_ROLES));

vehicleRouter.get("/", async (req, res, next) => {
  try {
    res.json(await vehicleService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

vehicleRouter.get("/:id", async (req, res, next) => {
  try {
    const vehicle = await vehicleService.getById(req.user!.schoolId, req.params.id);
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

vehicleRouter.post("/", validateBody(createVehicleSchema), async (req, res, next) => {
  try {
    res.status(201).json(await vehicleService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

vehicleRouter.patch("/:id", validateBody(updateVehicleSchema), async (req, res, next) => {
  try {
    const vehicle = await vehicleService.update(req.user!.schoolId, req.params.id, req.body);
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    res.json(vehicle);
  } catch (err) {
    next(err);
  }
});

vehicleRouter.delete("/:id", async (req, res, next) => {
  try {
    const vehicle = await vehicleService.remove(req.user!.schoolId, req.params.id);
    if (!vehicle) throw new HttpError(404, "Vehicle not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
