import { type FormEvent, useState } from "react";
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
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import type {
  ClasificacionGroupInput,
  CreateClasificacionInput,
} from "@/shared/schemas/clasificacion.schema";
import { createClasificacionSchema } from "@/shared/schemas/clasificacion.schema";
import { ClasificacionGroupEditor } from "./ClasificacionGroupEditor";

interface ClasificacionFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: { input: CreateClasificacionInput; loteId: string }) => void;
}

export function ClasificacionForm({
  pools,
  isLoading = false,
  onSubmit,
}: ClasificacionFormProps) {
  const [poolId, setPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [groups, setGroups] = useState<readonly ClasificacionGroupInput[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const crianzaPools = pools.filter((p) => p.pool_type === "crianza" && p.lotes.length > 0);

  const selectedPool = crianzaPools.find((p) => p.id === poolId);
  const activeLoteId = selectedPool?.lotes[0]?.id ?? "";
  const originTotal =
    selectedPool?.lotes[0]?.lote_size_compositions.reduce(
      (sum, c) => sum + c.animal_count,
      0
    ) ?? 0;

  function handlePoolChange(value: string | null) {
    if (!value) return;
    setPoolId(value);
    setGroups([]);
    setErrors({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const raw = {
      pool_id: poolId,
      event_date: eventDate,
      groups,
      notes: notes || undefined,
    };

    const result = createClasificacionSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit({ input: result.data, loteId: activeLoteId });
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
                if (!pool) return "Seleccionar pileta";
                const total = pool.lotes[0]?.lote_size_compositions.reduce(
                  (sum, c) => sum + c.animal_count,
                  0
                );
                return total !== undefined ? `${pool.name} — ${total} animales` : pool.name;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {crianzaPools.map((pool) => {
              const total = pool.lotes[0]?.lote_size_compositions.reduce(
                (sum, c) => sum + c.animal_count,
                0
              );
              return (
                <SelectItem key={pool.id} value={pool.id}>
                  {total !== undefined ? `${pool.name} — ${total} animales` : pool.name}
                </SelectItem>
              );
            })}
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
        <ClasificacionGroupEditor
          key={poolId}
          originTotal={originTotal}
          destinationPools={crianzaPools}
          onChange={setGroups}
          errors={errors}
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
        {isLoading ? "Registrando..." : "Registrar Clasificación"}
      </Button>
    </form>
  );
}
