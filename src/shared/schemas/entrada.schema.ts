import { z } from "zod";
import { sizeCompositionItemSchema } from "./lote.schema";

export const entradaOriginTypeSchema = z.enum([
  "proveedor_persona",
  "proveedor_empresa",
  "finca_propia",
  "incubador",
]);

const compositionsSchema = z
  .array(sizeCompositionItemSchema)
  .min(1, "Debe agregar al menos un grupo de talla");

const notFutureDate = (d: string) => d <= new Date().toLocaleDateString("en-CA");

const baseEntradaSchema = z.object({
  pool_id: z.string().uuid("Debe seleccionar una pileta válida"),
  entry_date: z
    .string()
    .date("Formato de fecha inválido")
    .refine(notFutureDate, "La fecha de ingreso no puede ser futura"),
  compositions: compositionsSchema,
  notes: z.string().max(2000).optional(),
});

const proveedorPersonaSchema = baseEntradaSchema.extend({
  origin_type: z.literal("proveedor_persona"),
  persona_full_name: z.string().min(1, "El nombre completo es requerido").max(255),
  persona_document_id: z.string().min(1, "El documento de identidad es requerido").max(50),
  persona_aval_code: z.string().max(100).optional(),
  persona_aval_file_path: z.string().optional(),
});

const proveedorEmpresaSchema = baseEntradaSchema.extend({
  origin_type: z.literal("proveedor_empresa"),
  empresa_name: z.string().min(1, "El nombre de la empresa es requerido").max(255),
  empresa_legal_rep: z.string().min(1, "El representante legal es requerido").max(255),
  empresa_nit: z.string().min(1, "El NIT es requerido").max(30),
  empresa_aval_code: z.string().max(100).optional(),
  empresa_aval_file_path: z.string().optional(),
});

const fincaPropiaSchema = baseEntradaSchema.extend({
  origin_type: z.literal("finca_propia"),
  origin_farm_id: z.string().uuid("Debe seleccionar la granja de origen"),
  origin_pool_id: z.string().uuid("Debe seleccionar la pileta de origen"),
});

const incubadorSchema = baseEntradaSchema.extend({
  origin_type: z.literal("incubador"),
  nido_number: z.string().min(1, "El número de nido es requerido").max(100),
  eclosion_date: z
    .string()
    .date("Formato de fecha inválido")
    .refine(notFutureDate, "La fecha de eclosión no puede ser futura"),
});

export const createEntradaSchema = z.discriminatedUnion("origin_type", [
  proveedorPersonaSchema,
  proveedorEmpresaSchema,
  fincaPropiaSchema,
  incubadorSchema,
]);

export type EntradaOriginType = z.infer<typeof entradaOriginTypeSchema>;
export type CreateEntradaInput = z.infer<typeof createEntradaSchema>;
export type ProveedorPersonaInput = z.infer<typeof proveedorPersonaSchema>;
export type ProveedorEmpresaInput = z.infer<typeof proveedorEmpresaSchema>;
export type FincaPropiaInput = z.infer<typeof fincaPropiaSchema>;
export type IncubadorInput = z.infer<typeof incubadorSchema>;
