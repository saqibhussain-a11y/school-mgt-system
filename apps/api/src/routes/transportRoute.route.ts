import { Router } from "express";
import { routeService } from "../services/route.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { HttpError } from "../middleware/errorHandler";
import { TRANSPORT_MANAGE_ROLES } from "./vehicle.route";
import { createRouteSchema, updateRouteSchema } from "../validation/transport.schema";

export const transportRouteRouter = Router();
transportRouteRouter.use(authenticate, authorize(...TRANSPORT_MANAGE_ROLES));

transportRouteRouter.get("/", async (req, res, next) => {
  try {
    res.json(await routeService.list(req.user!.schoolId));
  } catch (err) {
    next(err);
  }
});

transportRouteRouter.get("/:id", async (req, res, next) => {
  try {
    const route = await routeService.getById(req.user!.schoolId, req.params.id);
    if (!route) throw new HttpError(404, "Route not found");
    res.json(route);
  } catch (err) {
    next(err);
  }
});

transportRouteRouter.post("/", validateBody(createRouteSchema), async (req, res, next) => {
  try {
    res.status(201).json(await routeService.create(req.user!.schoolId, req.body));
  } catch (err) {
    next(err);
  }
});

transportRouteRouter.patch("/:id", validateBody(updateRouteSchema), async (req, res, next) => {
  try {
    const route = await routeService.update(req.user!.schoolId, req.params.id, req.body);
    if (!route) throw new HttpError(404, "Route not found");
    res.json(route);
  } catch (err) {
    next(err);
  }
});

transportRouteRouter.delete("/:id", async (req, res, next) => {
  try {
    const route = await routeService.remove(req.user!.schoolId, req.params.id);
    if (!route) throw new HttpError(404, "Route not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
