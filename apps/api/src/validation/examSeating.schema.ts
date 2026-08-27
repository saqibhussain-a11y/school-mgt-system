import { z } from "zod";

export const generateSeatingSchema = z.object({
  roomIds: z.array(z.string().min(1)).optional(),
});

export const assignSeatSchema = z.object({
  roomId: z.string().min(1),
  seatNumber: z.number().int().positive(),
});

export const assignColumnBlockSchema = z
  .object({
    roomId: z.string().min(1),
    columnId: z.string().min(1),
    seatFrom: z.number().int().positive(),
    seatTo: z.number().int().positive(),
    classId: z.string().min(1),
    sectionId: z.string().min(1).optional(),
  })
  .refine((data) => data.seatFrom <= data.seatTo, {
    message: "seatFrom must be less than or equal to seatTo",
    path: ["seatTo"],
  });
