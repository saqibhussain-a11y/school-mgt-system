import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { userService } from "../services/user.service";
import { HttpError } from "../middleware/errorHandler";

export const meRouter = Router();

meRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const user = await userService.findById(req.user!.sub);
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    res.json({ id: user.id, email: user.email, role: user.role, schoolId: user.schoolId });
  } catch (err) {
    next(err);
  }
});
