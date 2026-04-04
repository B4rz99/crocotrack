import { z } from "zod";
import { isoDateUtcNotAfterToday } from "@/shared/lib/iso-date";

const limpiezaProductItemSchema = z.object({
  cleaning_product_type_id: z.string().uuid("Debe seleccionar un producto"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
});

export const createLimpiezaSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta"),
  event_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(isoDateUtcNotAfterToday, "La fecha no puede ser futura"),
  products: z.array(limpiezaProductItemSchema).min(1, "Debe agregar al menos un producto"),
  notes: z.string().max(2000).optional(),
});

export type CreateLimpiezaInput = z.infer<typeof createLimpiezaSchema>;
