import { describe, expect, it } from "vitest";
import { createEntradaSchema } from "../entrada.schema";

const baseCompositions = [{ size_inches: 12, animal_count: 50 }];
const baseFields = {
  pool_id: "11111111-1111-1111-8111-111111111111",
  entry_date: "2026-04-01",
  compositions: baseCompositions,
};

describe("createEntradaSchema", () => {
  describe("proveedor_persona", () => {
    it("accepts valid input", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "proveedor_persona",
        persona_full_name: "Juan García",
        persona_document_id: "12345678",
      });
      expect(result.success).toBe(true);
    });

    it("accepts optional aval fields", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "proveedor_persona",
        persona_full_name: "Juan García",
        persona_document_id: "12345678",
        persona_aval_code: "AVAL-001",
        persona_aval_file_path: "org1/entrada1/doc.pdf",
        notes: "Nota de prueba",
      });
      expect(result.success).toBe(true);
    });

    it("rejects missing persona_full_name", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "proveedor_persona",
        persona_document_id: "12345678",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.issues.map((i) => i.path.join("."));
        expect(fields).toContain("persona_full_name");
      }
    });

    it("rejects missing persona_document_id", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "proveedor_persona",
        persona_full_name: "Juan García",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty persona_full_name", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "proveedor_persona",
        persona_full_name: "",
        persona_document_id: "12345678",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("proveedor_empresa", () => {
    const validEmpresa = {
      ...baseFields,
      origin_type: "proveedor_empresa" as const,
      empresa_name: "Crocofarm S.A.S.",
      empresa_legal_rep: "Pedro Rodríguez",
      empresa_nit: "900123456-1",
    };

    it("accepts valid input", () => {
      const result = createEntradaSchema.safeParse(validEmpresa);
      expect(result.success).toBe(true);
    });

    it("rejects missing empresa_name", () => {
      const result = createEntradaSchema.safeParse({
        ...validEmpresa,
        empresa_name: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing empresa_legal_rep", () => {
      const result = createEntradaSchema.safeParse({
        ...validEmpresa,
        empresa_legal_rep: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing empresa_nit", () => {
      const result = createEntradaSchema.safeParse({
        ...validEmpresa,
        empresa_nit: undefined,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("finca_propia", () => {
    const validFinca = {
      ...baseFields,
      origin_type: "finca_propia" as const,
      origin_farm_id: "22222222-2222-2222-8222-222222222222",
      origin_pool_id: "33333333-3333-3333-8333-333333333333",
    };

    it("accepts valid input", () => {
      const result = createEntradaSchema.safeParse(validFinca);
      expect(result.success).toBe(true);
    });

    it("rejects missing origin_farm_id", () => {
      const result = createEntradaSchema.safeParse({
        ...validFinca,
        origin_farm_id: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid origin_pool_id (not uuid)", () => {
      const result = createEntradaSchema.safeParse({
        ...validFinca,
        origin_pool_id: "not-a-valid-uuid",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("incubador", () => {
    const validIncubador = {
      ...baseFields,
      origin_type: "incubador" as const,
      nido_number: "N-042",
      eclosion_date: "2026-03-15",
    };

    it("accepts valid input", () => {
      const result = createEntradaSchema.safeParse(validIncubador);
      expect(result.success).toBe(true);
    });

    it("rejects missing nido_number", () => {
      const result = createEntradaSchema.safeParse({
        ...validIncubador,
        nido_number: undefined,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing eclosion_date", () => {
      const result = createEntradaSchema.safeParse({
        ...validIncubador,
        eclosion_date: undefined,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("shared base validation", () => {
    it("rejects empty compositions array", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        compositions: [],
        origin_type: "incubador",
        nido_number: "N-001",
        eclosion_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid pool_id (not uuid)", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        pool_id: "not-a-valid-uuid",
        origin_type: "incubador",
        nido_number: "N-001",
        eclosion_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid size_inches (0)", () => {
      const result = createEntradaSchema.safeParse({
        pool_id: baseFields.pool_id,
        entry_date: baseFields.entry_date,
        compositions: [{ size_inches: 0, animal_count: 10 }],
        origin_type: "incubador",
        nido_number: "N-001",
        eclosion_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid animal_count (negative)", () => {
      const result = createEntradaSchema.safeParse({
        pool_id: baseFields.pool_id,
        entry_date: baseFields.entry_date,
        compositions: [{ size_inches: 12, animal_count: -5 }],
        origin_type: "incubador",
        nido_number: "N-001",
        eclosion_date: "2026-01-01",
      });
      expect(result.success).toBe(false);
    });

    it("rejects unknown origin_type", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        origin_type: "desconocido",
      });
      expect(result.success).toBe(false);
    });

    it("accepts multiple size groups", () => {
      const result = createEntradaSchema.safeParse({
        ...baseFields,
        compositions: [
          { size_inches: 12, animal_count: 30 },
          { size_inches: 18, animal_count: 20 },
          { size_inches: 24, animal_count: 10 },
        ],
        origin_type: "incubador",
        nido_number: "N-001",
        eclosion_date: "2026-01-01",
      });
      expect(result.success).toBe(true);
    });
  });
});
