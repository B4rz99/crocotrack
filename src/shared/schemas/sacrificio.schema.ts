import { z } from "zod";

/** ISO `YYYY-MM-DD` must not be after the user's local calendar today. */
function isNotFutureYmd(val: string): boolean {
  const parts = val.split("-");
  if (parts.length !== 3) return false;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return false;
  const eventDay = new Date(y, m - 1, d);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return eventDay.getTime() <= todayStart.getTime();
}

export const rejectedGroupSchema = z.object({
  animal_count: z.number().int().positive("La cantidad debe ser mayor a 0"),
  destination_pool_id: z.string().uuid("Debe seleccionar una pileta destino"),
});

export const sacrificioGroupSchema = z
  .object({
    size_inches: z
      .number()
      .int("La talla debe ser un número entero")
      .positive("La talla debe ser mayor a 0"),
    sacrificed_count: z.number().int("Debe ser un número entero").min(0, "No puede ser negativo"),
    rejected: z.array(rejectedGroupSchema).default([]),
  })
  .refine((g) => g.sacrificed_count + g.rejected.reduce((sum, r) => sum + r.animal_count, 0) > 0, {
    message: "Cada grupo debe tener al menos un animal",
    path: ["sacrificed_count"],
  })
  .refine(
    (g) => {
      const destIds = g.rejected.map((r) => r.destination_pool_id);
      return destIds.length === new Set(destIds).size;
    },
    { message: "No puede haber destinos duplicados en el mismo grupo", path: ["rejected"] }
  );

export const createSacrificioSchema = z
  .object({
    pool_id: z.string().uuid("Debe seleccionar una pileta de origen"),
    event_date: z
      .string()
      .date("Formato de fecha inválido")
      .refine(isNotFutureYmd, "La fecha no puede ser futura"),
    groups: z.array(sacrificioGroupSchema).min(1, "Debe agregar al menos un grupo de talla"),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      const sizes = data.groups.map((g) => g.size_inches);
      return sizes.length === new Set(sizes).size;
    },
    { message: "No puede haber tallas duplicadas", path: ["groups"] }
  );

export type RejectedGroupInput = z.infer<typeof rejectedGroupSchema>;
export type SacrificioGroupInput = z.infer<typeof sacrificioGroupSchema>;
export type CreateSacrificioInput = z.infer<typeof createSacrificioSchema>;
