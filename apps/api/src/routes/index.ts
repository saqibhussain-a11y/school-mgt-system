import { Router } from "express";
import { healthRouter } from "./health.route";
import { schoolRouter } from "./school.route";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/schools", schoolRouter);
