import { z } from "zod";
import { RoomType } from "@sms/db";

export const createRoomSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(RoomType).default(RoomType.GENERAL),
  capacity: z.number().int().positive().optional(),
});

export const updateRoomSchema = createRoomSchema;
