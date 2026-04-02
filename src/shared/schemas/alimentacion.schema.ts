import { z } from "zod";

const notFutureDate = (val: string) => val <= new Date().toISOString().slice(0, 10);

export const createAlimentacionSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta valida"),
  food_type_id: z.string().uuid("Debe seleccionar un tipo de alimento"),
  event_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  quantity_kg: z
    .number()
    .positive("La cantidad debe ser mayor a 0")
    .max(99999999.99, "La cantidad excede el maximo permitido"),
  notes: z.string().max(2000).optional(),
});

export type CreateAlimentacionInput = z.infer<typeof createAlimentacionSchema>;

export const createFoodPurchaseSchema = z.object({
  food_type_id: z.string().uuid("Debe seleccionar un tipo de alimento"),
  purchase_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  quantity_kg: z
    .number()
    .positive("La cantidad debe ser mayor a 0")
    .max(99999999.99, "La cantidad excede el maximo permitido"),
  supplier: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateFoodPurchaseInput = z.infer<typeof createFoodPurchaseSchema>;
