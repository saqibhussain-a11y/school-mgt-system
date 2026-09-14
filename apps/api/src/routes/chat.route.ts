import { Router } from "express";
import { Role } from "@sms/db";
import { chatService } from "../services/chat.service";
import { authenticate, authorize } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate";
import { chatMessageLimiter } from "../middleware/rateLimit";
import { sendChatMessageSchema } from "../validation/chat.schema";

export const chatRouter = Router();
chatRouter.use(authenticate, authorize(Role.PARENT, Role.STUDENT));

chatRouter.get("/", async (req, res, next) => {
  try {
    const history = await chatService.getHistory(req.user!.schoolId, req.user!.sub);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

chatRouter.post("/", chatMessageLimiter, validateBody(sendChatMessageSchema), async (req, res, next) => {
  try {
    const reply = await chatService.sendMessage(req.user!.schoolId, req.user!, req.body.content);
    res.status(201).json(reply);
  } catch (err) {
    next(err);
  }
});

chatRouter.delete("/", async (req, res, next) => {
  try {
    await chatService.clearHistory(req.user!.schoolId, req.user!.sub);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
