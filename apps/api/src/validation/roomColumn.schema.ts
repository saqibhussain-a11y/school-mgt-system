import { z } from "zod";

export const createRoomColumnSchema = z.object({
  roomId: z.string().min(1),
  columnNumber: z.number().int().positive(),
  seatCapacity: z.number().int().positive(),
});

export const updateRoomColumnSchema = z.object({
  columnNumber: z.number().int().positive().optional(),
  seatCapacity: z.number().int().positive().optional(),
});
