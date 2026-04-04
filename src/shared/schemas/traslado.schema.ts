import { z } from "zod";
import { sizeCompositionItemSchema } from "./lote.schema";

const notFutureDate = (val: string) => val <= new Date().toLocaleDateString("en-CA");

export const createTrasladoSchema = z
  .object({
    pool_id: z.string().uuid("Debe seleccionar una pileta de origen"),
    destination_pool_id: z.string().uuid("Debe seleccionar una pileta de destino"),
    event_date: z
      .string()
      .date("Formato de fecha invalido")
      .refine(notFutureDate, "La fecha no puede ser futura"),
    compositions: z
      .array(sizeCompositionItemSchema)
      .min(1, "Debe seleccionar al menos un grupo de animales"),
    notes: z.string().max(2000).optional(),
  })
  .refine((data) => data.pool_id !== data.destination_pool_id, {
    message: "La pileta de destino debe ser diferente a la de origen",
    path: ["destination_pool_id"],
  });

export type CreateTrasladoInput = z.infer<typeof createTrasladoSchema>;
