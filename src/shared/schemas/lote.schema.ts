import { z } from "zod";

export const loteStatusSchema = z.enum(["activo", "cerrado"]);

export const sizeCompositionItemSchema = z.object({
  size_inches: z
    .number()
    .int("El tamaño debe ser un número entero")
    .min(1, "El tamaño mínimo es 1 pulgada")
    .max(120, "El tamaño máximo es 120 pulgadas"),
  animal_count: z
    .number()
    .int("La cantidad debe ser un número entero")
    .positive("La cantidad debe ser mayor a 0"),
});

export const createLoteSchema = z.object({
  pool_id: z.string().uuid(),
  compositions: z
    .array(sizeCompositionItemSchema)
    .min(1, "Debe agregar al menos una composición de tamaño"),
});

export const updateLoteCompositionsSchema = z.object({
  compositions: z
    .array(sizeCompositionItemSchema)
    .min(1, "Debe agregar al menos una composición de tamaño"),
});

export const closeLoteSchema = z.object({
  closed_at: z.string().datetime().optional(),
});

export type LoteStatus = z.infer<typeof loteStatusSchema>;
export type SizeCompositionItem = z.infer<typeof sizeCompositionItemSchema>;
export type CreateLoteInput = z.infer<typeof createLoteSchema>;
export type UpdateLoteCompositionsInput = z.infer<typeof updateLoteCompositionsSchema>;
export type CloseLoteInput = z.infer<typeof closeLoteSchema>;
