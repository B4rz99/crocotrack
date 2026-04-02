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
import type { CreateMortalidadInput } from "@/shared/schemas/mortalidad.schema";
import { createMortalidadSchema } from "@/shared/schemas/mortalidad.schema";
import { LoteSizeSelector } from "./LoteSizeSelector";

interface MortalidadFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: { input: CreateMortalidadInput; loteId: string }) => void;
}

export function MortalidadForm({ pools, isLoading = false, onSubmit }: MortalidadFormProps) {
  const [poolId, setPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [compositions, setCompositions] = useState<
    ReadonlyArray<{ size_inches: number; animal_count: number }>
  >([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Only crianza pools with an active lote can have mortality registered
  const crianzaPools = pools.filter((p) => p.pool_type === "crianza" && p.lotes.length > 0);

  const selectedPool = crianzaPools.find((p) => p.id === poolId);
  const activeLoteCompositions = selectedPool?.lotes[0]?.lote_size_compositions ?? [];
  const activeLoteId = selectedPool?.lotes[0]?.id ?? "";

  function handlePoolChange(value: string | null) {
    if (!value) return;
    setPoolId(value);
    setCompositions([]);
    setErrors({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Validate deaths don't exceed available per size
    const available = Object.fromEntries(
      activeLoteCompositions.map((c) => [c.size_inches, c.animal_count])
    );
    const overflowSize = compositions.find((c) => (available[c.size_inches] ?? 0) < c.animal_count);
    if (overflowSize) {
      setErrors({
        compositions: `Stock insuficiente para talla ${overflowSize.size_inches} pulgadas`,
      });
      return;
    }

    const raw = {
      pool_id: poolId,
      event_date: eventDate,
      compositions,
      notes: notes || undefined,
    };

    const result = createMortalidadSchema.safeParse(raw);

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
        <Label htmlFor="pool-select">Pileta</Label>
        <Select value={poolId} onValueChange={handlePoolChange}>
          <SelectTrigger id="pool-select" className="w-full" aria-invalid={!!errors.pool_id}>
            <SelectValue>{() => selectedPool?.name ?? "Seleccionar pileta"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {crianzaPools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.name}
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
        <LoteSizeSelector
          key={poolId}
          compositions={activeLoteCompositions}
          onChange={setCompositions}
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
        {isLoading ? "Registrando..." : "Registrar Mortalidad"}
      </Button>
    </form>
  );
}
