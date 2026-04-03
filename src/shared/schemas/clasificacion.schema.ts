import { z } from "zod";

const notFutureDate = (val: string) => val <= new Date().toLocaleDateString("en-CA");

export const clasificacionGroupSchema = z.object({
  size_inches: z.number().int().positive("La talla debe ser mayor a 0"),
  animal_count: z.number().int().positive("La cantidad debe ser mayor a 0"),
  destination_pool_id: z.string().uuid("Debe seleccionar una pileta destino"),
});

export const createClasificacionSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta de origen"),
  event_date: z
    .string()
    .date("Formato de fecha inválido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  groups: z.array(clasificacionGroupSchema).min(1, "Debe agregar al menos un grupo"),
  notes: z.string().max(2000).optional(),
});

export type ClasificacionGroupInput = z.infer<typeof clasificacionGroupSchema>;
export type CreateClasificacionInput = z.infer<typeof createClasificacionSchema>;
