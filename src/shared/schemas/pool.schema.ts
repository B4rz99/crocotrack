import { z } from "zod";

export const poolTypeSchema = z.enum(["crianza", "reproductor"]);

export const createPoolSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(255),
  code: z.string().max(20).optional(),
  pool_type: poolTypeSchema,
  capacity: z.number().int().positive(),
});

export type CreatePoolInput = z.infer<typeof createPoolSchema>;
