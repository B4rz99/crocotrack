import { z } from "zod";
import { sizeCompositionItemSchema } from "./lote.schema";

const notFutureDate = (val: string) => val <= new Date().toLocaleDateString("en-CA");

export const createMortalidadSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta válida"),
  event_date: z
    .string()
    .date("Formato de fecha invalido")
    .refine(notFutureDate, "La fecha no puede ser futura"),
  compositions: z.array(sizeCompositionItemSchema).min(1, "Debe reportar al menos una baja"),
  notes: z.string().max(2000).optional(),
});

export type CreateMortalidadInput = z.infer<typeof createMortalidadSchema>;
