import { type FormEvent, useMemo, useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { zodArrayFieldErrors, zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import type {
  CreateSacrificioInput,
  SacrificioGroupInput,
} from "@/shared/schemas/sacrificio.schema";
import { createSacrificioSchema } from "@/shared/schemas/sacrificio.schema";
import { SacrificioGroupEditor } from "./SacrificioGroupEditor";

interface SacrificioFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: {
    input: CreateSacrificioInput;
    loteId: string;
    loteTotal: number;
  }) => void;
}

function poolOriginLabel(pool: PoolWithLotes): string {
  const total = pool.lotes[0]?.lote_size_compositions.reduce((sum, c) => sum + c.animal_count, 0);
  return total !== undefined ? `${pool.name} — ${total} animales` : pool.name;
}

function countProcessed(groups: readonly SacrificioGroupInput[]): number {
  return groups.reduce(
    (sum, g) => sum + g.sacrificed_count + g.rejected.reduce((rs, r) => rs + r.animal_count, 0),
    0
  );
}

export function SacrificioForm({ pools, isLoading = false, onSubmit }: SacrificioFormProps) {
  const [poolId, setPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [groups, setGroups] = useState<readonly SacrificioGroupInput[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [groupErrors, setGroupErrors] = useState<Record<number, Record<string, string>>>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const crianzaPools = pools.filter((p) => p.pool_type === "crianza" && p.lotes.length > 0);
  const allCrianzaPools = pools.filter((p) => p.pool_type === "crianza");

  const selectedPool = crianzaPools.find((p) => p.id === poolId);
  const activeLoteId = selectedPool?.lotes[0]?.id ?? "";
  const loteTotal =
    selectedPool?.lotes[0]?.lote_size_compositions.reduce((sum, c) => sum + c.animal_count, 0) ?? 0;

  const faltantesPreview = useMemo(
    () => Math.max(0, loteTotal - countProcessed(groups)),
    [groups, loteTotal]
  );

  function handlePoolChange(value: string | null) {
    if (!value) return;
    setPoolId(value);
    setGroups([]);
    setErrors({});
    setGroupErrors({});
    setShowConfirm(false);
  }

  function doSubmit() {
    const raw = {
      pool_id: poolId,
      event_date: eventDate,
      groups,
      notes: notes || undefined,
    };

    const result = createSacrificioSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      setGroupErrors(zodArrayFieldErrors(result.error, "groups"));
      return;
    }

    const totalProcessed = countProcessed(result.data.groups);

    if (totalProcessed > loteTotal) {
      setErrors({ groups: "El total procesado excede el inventario del lote" });
      return;
    }

    const faltantes = loteTotal - totalProcessed;
    if (faltantes > 0 && !showConfirm) {
      setShowConfirm(true);
      return;
    }

    setShowConfirm(false);
    onSubmit({ input: result.data, loteId: activeLoteId, loteTotal });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setGroupErrors({});
    doSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-date">Fecha del evento</Label>
        <Input
          id="event-date"
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          aria-invalid={!!errors.event_date}
        />
        <FieldError message={errors.event_date} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pool-select">Pileta de origen</Label>
        <Select value={poolId} onValueChange={handlePoolChange}>
          <SelectTrigger id="pool-select" className="w-full" aria-invalid={!!errors.pool_id}>
            <SelectValue>
              {() => {
                const pool = crianzaPools.find((p) => p.id === poolId);
                return pool ? poolOriginLabel(pool) : "Seleccionar pileta";
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {crianzaPools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {poolOriginLabel(pool)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {crianzaPools.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No hay piletas de crianza con lote activo.
          </p>
        )}
        <FieldError message={errors.pool_id} />
      </div>

      {poolId && (
        <SacrificioGroupEditor
          key={poolId}
          loteTotal={loteTotal}
          destinationPools={allCrianzaPools}
          onChange={setGroups}
          errors={errors}
          groupErrors={groupErrors}
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

      {showConfirm && (
        <div className="rounded-lg border border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Hay {faltantesPreview} animales sin contabilizar. ¿Desea continuar?
          </p>
          <div className="flex gap-2">
            <Button type="submit" variant="default" size="sm">
              Sí, registrar
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowConfirm(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!showConfirm && (
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Registrando..." : "Registrar Sacrificio"}
        </Button>
      )}
    </form>
  );
}
