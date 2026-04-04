import { z } from "zod";

const notFutureDate = (val: string) => val <= new Date().toLocaleDateString("en-CA");

export const createCleaningPurchaseSchema = z.object({
  cleaning_product_type_id: z.string().uuid("Debe seleccionar un producto"),
  purchase_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  quantity: z
    .number()
    .int("La cantidad debe ser un número entero")
    .min(1, "La cantidad mínima es 1"),
  supplier: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateCleaningPurchaseInput = z.infer<typeof createCleaningPurchaseSchema>;
