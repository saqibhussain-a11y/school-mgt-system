import { Router } from "express";
import { prisma } from "@sms/db";

export const healthRouter = Router();

// Was unconditional `{status:"ok"}` — meant a PaaS health-check-based
// restart/alert would never fire even with the DB fully down, since the one
// signal it watches was decoupled from reality. A real `SELECT 1` makes this
// endpoint actually reflect whether the app can serve requests.
healthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok" });
  } catch {
    res.status(503).json({ status: "error", detail: "database unreachable" });
  }
});
