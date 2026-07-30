import { Router } from "express";
import { schoolService } from "../services/school.service";

export const schoolRouter = Router();

schoolRouter.get("/", async (_req, res, next) => {
  try {
    const schools = await schoolService.getAll();
    res.json(schools);
  } catch (err) {
    next(err);
  }
});
