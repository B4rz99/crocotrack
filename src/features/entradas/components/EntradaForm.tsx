import { type FormEvent, useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { PoolCombobox } from "@/features/farms/components/PoolCombobox";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import type { EntradaOriginType } from "@/shared/schemas/entrada.schema";
import { createEntradaSchema } from "@/shared/schemas/entrada.schema";
import type { SizeCompositionItem } from "@/shared/schemas/lote.schema";
import { FincaPropiaFields } from "./FincaPropiaFields";
import { IncubadorFields } from "./IncubadorFields";
import { OriginTypeSelector } from "./OriginTypeSelector";
import { ProveedorEmpresaFields } from "./ProveedorEmpresaFields";
import { ProveedorPersonaFields } from "./ProveedorPersonaFields";
import { SizeGroupEditor } from "./SizeGroupEditor";

interface EntradaFormProps {
  readonly farmId: string;
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: {
    input: ReturnType<typeof createEntradaSchema.parse>;
    avalFile?: File;
  }) => void;
}

export function EntradaForm({ farmId, pools, isLoading = false, onSubmit }: EntradaFormProps) {
  const [poolId, setPoolId] = useState("");
  const [entryDate, setEntryDate] = useState(todayIsoDate);
  const [originType, setOriginType] = useState<EntradaOriginType | undefined>(undefined);
  const [compositions, setCompositions] = useState<SizeCompositionItem[]>([
    { size_inches: 0, animal_count: 0 },
  ]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Proveedor persona state
  const [personaFullName, setPersonaFullName] = useState("");
  const [personaDocumentId, setPersonaDocumentId] = useState("");
  const [personaAvalCode, setPersonaAvalCode] = useState("");
  const [personaAvalFile, setPersonaAvalFile] = useState<File | undefined>(undefined);

  // Proveedor empresa state
  const [empresaName, setEmpresaName] = useState("");
  const [empresaLegalRep, setEmpresaLegalRep] = useState("");
  const [empresaNit, setEmpresaNit] = useState("");
  const [empresaAvalCode, setEmpresaAvalCode] = useState("");
  const [empresaAvalFile, setEmpresaAvalFile] = useState<File | undefined>(undefined);

  // Finca propia state
  const [originFarmId, setOriginFarmId] = useState<string | undefined>(undefined);
  const [originPoolId, setOriginPoolId] = useState<string | undefined>(undefined);
  const [maxForSize, setMaxForSize] = useState<Record<number, number>>({});

  // Incubador state
  const [nidoNumber, setNidoNumber] = useState("");
  const [eclosionDate, setEclosionDate] = useState("");

  function handleOriginTypeChange(type: EntradaOriginType) {
    setOriginType(type);
    if (type !== "finca_propia") {
      setCompositions([{ size_inches: 0, animal_count: 0 }]);
      setMaxForSize({});
    }
  }

  function handleOriginFarmChange(fId: string) {
    setOriginFarmId(fId);
    setOriginPoolId(undefined);
    setCompositions([{ size_inches: 0, animal_count: 0 }]);
    setMaxForSize({});
  }

  function handleOriginPoolChange(pId: string, comps: SizeCompositionItem[]) {
    if (pId === "") {
      setOriginPoolId(undefined);
      setMaxForSize({});
      setCompositions([{ size_inches: 0, animal_count: 0 }]);
      return;
    }
    setOriginPoolId(pId);
    const newMax = Object.fromEntries(comps.map((c) => [c.size_inches, c.animal_count])) as Record<
      number,
      number
    >;
    setMaxForSize(newMax);
    setCompositions(
      comps.map((c) => ({ size_inches: c.size_inches, animal_count: c.animal_count }))
    );
  }

  function buildRawInput(): Record<string, unknown> {
    const base = {
      pool_id: poolId,
      entry_date: entryDate,
      compositions: compositions.filter((c) => c.size_inches > 0 && c.animal_count > 0),
      notes: notes || undefined,
      origin_type: originType,
    };

    if (originType === "proveedor_persona") {
      return {
        ...base,
        persona_full_name: personaFullName,
        persona_document_id: personaDocumentId,
        persona_aval_code: personaAvalCode || undefined,
      };
    }
    if (originType === "proveedor_empresa") {
      return {
        ...base,
        empresa_name: empresaName,
        empresa_legal_rep: empresaLegalRep,
        empresa_nit: empresaNit,
        empresa_aval_code: empresaAvalCode || undefined,
      };
    }
    if (originType === "finca_propia") {
      return { ...base, origin_farm_id: originFarmId, origin_pool_id: originPoolId };
    }
    if (originType === "incubador") {
      return { ...base, nido_number: nidoNumber, eclosion_date: eclosionDate };
    }
    return base;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!originType) {
      setErrors({ origin_type: "Seleccione un tipo de origen" });
      return;
    }

    const raw = buildRawInput();
    const result = createEntradaSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    const avalFile =
      originType === "proveedor_persona"
        ? personaAvalFile
        : originType === "proveedor_empresa"
          ? empresaAvalFile
          : undefined;

    onSubmit({ input: result.data, avalFile });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="entry-date">Fecha de ingreso</Label>
        <Input
          id="entry-date"
          type="date"
          value={entryDate}
          onChange={(e) => setEntryDate(e.target.value)}
          aria-invalid={!!errors.entry_date}
        />
        <FieldError message={errors.entry_date} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pool-destino-combobox">Pileta destino</Label>
        <PoolCombobox
          id="pool-destino-combobox"
          pools={pools}
          value={poolId}
          onChange={(id) => {
            setPoolId(id);
            if (id) setErrors((prev) => ({ ...prev, pool_id: "" }));
          }}
          error={errors.pool_id}
        />
        <FieldError message={errors.pool_id} />
      </div>

      <div className="space-y-2">
        <Label>Tipo de origen</Label>
        <OriginTypeSelector
          value={originType}
          onChange={handleOriginTypeChange}
          error={errors.origin_type}
        />
      </div>

      {originType === "proveedor_persona" && (
        <ProveedorPersonaFields
          fullName={personaFullName}
          documentId={personaDocumentId}
          avalCode={personaAvalCode}
          avalFile={personaAvalFile}
          onFullNameChange={setPersonaFullName}
          onDocumentIdChange={setPersonaDocumentId}
          onAvalCodeChange={setPersonaAvalCode}
          onAvalFileChange={setPersonaAvalFile}
          errors={errors}
        />
      )}

      {originType === "proveedor_empresa" && (
        <ProveedorEmpresaFields
          empresaName={empresaName}
          legalRep={empresaLegalRep}
          nit={empresaNit}
          avalCode={empresaAvalCode}
          avalFile={empresaAvalFile}
          onEmpresaNameChange={setEmpresaName}
          onLegalRepChange={setEmpresaLegalRep}
          onNitChange={setEmpresaNit}
          onAvalCodeChange={setEmpresaAvalCode}
          onAvalFileChange={setEmpresaAvalFile}
          errors={errors}
        />
      )}

      {originType === "finca_propia" && (
        <FincaPropiaFields
          currentFarmId={farmId}
          originFarmId={originFarmId}
          originPoolId={originPoolId}
          onOriginFarmChange={handleOriginFarmChange}
          onOriginPoolChange={handleOriginPoolChange}
          errors={errors}
        />
      )}

      {originType === "incubador" && (
        <IncubadorFields
          nidoNumber={nidoNumber}
          eclosionDate={eclosionDate}
          onNidoNumberChange={setNidoNumber}
          onEclosionDateChange={setEclosionDate}
          errors={errors}
        />
      )}

      {originType && (
        <SizeGroupEditor
          groups={compositions}
          onChange={setCompositions}
          errors={errors}
          maxForSize={originType === "finca_propia" ? maxForSize : undefined}
        />
      )}

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          placeholder="Observaciones adicionales..."
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Registrando..." : "Registrar Entrada"}
      </Button>
    </form>
  );
}
