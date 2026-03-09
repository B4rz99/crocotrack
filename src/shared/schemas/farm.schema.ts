import { z } from "zod";

export const createFarmSchema = z.object({
  name: z.string().min(1).max(255),
  location: z.string().max(500).optional(),
});

export type CreateFarmInput = z.infer<typeof createFarmSchema>;
