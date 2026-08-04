import { Router } from "express";
import { schoolService } from "../services/school.service";

export const schoolRouter = Router();

// Deliberately unauthenticated (the login page needs it pre-credentials) but
// deliberately trimmed to {id, name} — see schoolService.listForLogin.
schoolRouter.get("/", async (_req, res, next) => {
  try {
    const schools = await schoolService.listForLogin();
    res.json(schools);
  } catch (err) {
    next(err);
  }
});
