import { z } from "zod";

export const generateSeatingSchema = z.object({
  roomIds: z.array(z.string().min(1)).optional(),
});

export const assignSeatSchema = z.object({
  roomId: z.string().min(1),
  seatNumber: z.number().int().positive(),
});
