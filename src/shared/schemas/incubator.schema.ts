import { z } from "zod";

export const createIncubatorSchema = z.object({
  name: z.string().min(1).max(255),
  capacity: z.number().int().positive().optional(),
  temp_min: z.number().min(0).max(50).optional(),
  temp_max: z.number().min(0).max(50).optional(),
  humidity_min: z.number().min(0).max(100).optional(),
  humidity_max: z.number().min(0).max(100).optional(),
});

export type CreateIncubatorInput = z.infer<typeof createIncubatorSchema>;
