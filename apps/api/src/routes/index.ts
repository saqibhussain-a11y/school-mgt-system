import { Router } from "express";
import { healthRouter } from "./health.route";
import { schoolRouter } from "./school.route";
import { authRouter } from "./auth.route";
import { meRouter } from "./me.route";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/schools", schoolRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/me", meRouter);
