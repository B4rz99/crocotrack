import { z } from "zod";

export const createFoodTypeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  unit: z.string().default("kg"),
});

export type CreateFoodTypeInput = z.infer<typeof createFoodTypeSchema>;
