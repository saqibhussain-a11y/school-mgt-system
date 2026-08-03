import { z } from "zod";

export const createVehicleSchema = z.object({
  registrationNo: z.string().min(1),
  capacity: z.number().int().positive(),
  driverName: z.string().min(1),
  driverPhone: z.string().min(1),
});

export const updateVehicleSchema = createVehicleSchema;

export const createRouteSchema = z.object({
  name: z.string().min(1),
  vehicleId: z.string().min(1),
});

export const updateRouteSchema = z.object({
  name: z.string().min(1),
  vehicleId: z.string().min(1),
});

export const assignStudentRouteSchema = z.object({
  studentId: z.string().min(1),
  routeId: z.string().min(1),
  pickupStop: z.string().optional(),
});
