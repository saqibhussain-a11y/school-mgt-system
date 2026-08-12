import { Router } from "express";
import { logger } from "../lib/logger";
import { clientErrorReportLimiter } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import { reportClientErrorSchema } from "../validation/clientError.schema";

export const clientErrorRouter = Router();

// Deliberately unauthenticated — a crashed frontend can't guarantee a valid
// token — and deliberately not gated behind `authenticate`, so a School
// tenant context is never assumed. This is the closest thing to error
// tracking this pass ships: no third-party APM, just routing a frontend
// crash into the same structured backend logs as everything else, instead
// of it vanishing into the one browser tab that hit it.
clientErrorRouter.post(
  "/",
  clientErrorReportLimiter,
  validateBody(reportClientErrorSchema),
  (req, res) => {
    logger.error(
      { source: "frontend", message: req.body.message, stack: req.body.stack, digest: req.body.digest, url: req.body.url },
      "Frontend error boundary triggered",
    );
    res.status(204).send();
  },
);
