import { z } from "zod";

export const createCleaningProductTypeSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
});

export type CreateCleaningProductTypeInput = z.infer<typeof createCleaningProductTypeSchema>;
