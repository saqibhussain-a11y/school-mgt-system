import { z } from "zod";

export const markerSchema = z.object({
  id: z.string().min(1),
  fieldKey: z.string().min(1),
  xRatio: z.number().min(0).max(1),
  yRatio: z.number().min(0).max(1),
  fontSize: z.number().int().positive().optional(),
});

export const updateMarkersSchema = z.object({
  markers: z.array(markerSchema),
});
