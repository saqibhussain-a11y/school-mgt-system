import { z } from "zod";

export const sendChatMessageSchema = z.object({
  content: z.string().min(1).max(2000),
});
