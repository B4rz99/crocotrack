import { type FormEvent, useMemo, useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { PoolCombobox } from "@/features/farms/components/PoolCombobox";
import { LoteSizeSelector } from "@/shared/components/LoteSizeSelector";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { zodFieldErrors } from "@/shared/lib/form-utils";
import { todayIsoDate } from "@/shared/lib/utils";
import type { CreateTrasladoInput } from "@/shared/schemas/traslado.schema";
import { createTrasladoSchema } from "@/shared/schemas/traslado.schema";

function trasladoDestinationOptionLabel(pool: PoolWithLotes): string {
  const count =
    pool.lotes[0]?.lote_size_compositions.reduce((sum, c) => sum + c.animal_count, 0) ?? 0;
  return pool.capacity != null
    ? `${pool.name} (${count}/${pool.capacity})`
    : `${pool.name} (${count})`;
}

interface TrasladoFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: { input: CreateTrasladoInput; loteId: string }) => void;
}

export function TrasladoForm({ pools, isLoading = false, onSubmit }: TrasladoFormProps) {
  const [poolId, setPoolId] = useState("");
  const [destinationPoolId, setDestinationPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [compositions, setCompositions] = useState<
    ReadonlyArray<{ size_inches: number; animal_count: number }>
  >([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const crianzaPools = pools.filter((p) => p.pool_type === "crianza");
  const originPools = crianzaPools.filter((p) => p.lotes.length > 0);
  const destinationPools = crianzaPools.filter((p) => p.id !== poolId);

  const selectedOrigin = originPools.find((p) => p.id === poolId);
  const selectedDestination = crianzaPools.find((p) => p.id === destinationPoolId);
  const activeLoteCompositions = selectedOrigin?.lotes[0]?.lote_size_compositions ?? [];
  const activeLoteId = selectedOrigin?.lotes[0]?.id ?? "";

  const transferTotal = compositions.reduce((sum, c) => sum + c.animal_count, 0);

  const capacityWarning = useMemo(() => {
    if (!selectedDestination?.capacity) return null;
    const currentCount =
      selectedDestination.lotes[0]?.lote_size_compositions.reduce(
        (sum, c) => sum + c.animal_count,
        0
      ) ?? 0;
    const afterTransfer = currentCount + transferTotal;
    if (afterTransfer > selectedDestination.capacity) {
      return `Este traslado excedería la capacidad de la pileta (${afterTransfer}/${selectedDestination.capacity} animales).`;
    }
    return null;
  }, [selectedDestination, transferTotal]);

  function handleOriginChange(originId: string) {
    setPoolId(originId);
    setDestinationPoolId("");
    setCompositions([]);
    if (originId) setErrors({});
  }

  function handleDestinationChange(destId: string) {
    setDestinationPoolId(destId);
    setErrors((prev) => {
      const { destination_pool_id: _, ...rest } = prev;
      return rest;
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

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
      destination_pool_id: destinationPoolId,
      event_date: eventDate,
      compositions,
      notes: notes || undefined,
    };

    const result = createTrasladoSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit({ input: result.data, loteId: activeLoteId });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-date">Fecha del traslado</Label>
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
        <Label htmlFor="origin-pool-combobox">Pileta de origen</Label>
        {originPools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay piletas de crianza con lote activo.
          </p>
        ) : (
          <PoolCombobox
            id="origin-pool-combobox"
            pools={originPools}
            value={poolId}
            onChange={handleOriginChange}
            placeholder="Buscar pileta de origen…"
            error={errors.pool_id}
          />
        )}
        <FieldError message={errors.pool_id} />
      </div>

      {poolId && (
        <LoteSizeSelector
          key={poolId}
          compositions={activeLoteCompositions}
          onChange={setCompositions}
          errors={errors}
          label="Animales a trasladar por talla"
        />
      )}

      {poolId && (
        <div className="space-y-2">
          <Label htmlFor="destination-pool-combobox">Pileta de destino</Label>
          <PoolCombobox
            id="destination-pool-combobox"
            pools={destinationPools}
            value={destinationPoolId}
            onChange={handleDestinationChange}
            getOptionLabel={trasladoDestinationOptionLabel}
            showCodeHint={false}
            placeholder="Buscar pileta de destino…"
            error={errors.destination_pool_id}
          />
          {capacityWarning && <p className="text-sm text-amber-600">{capacityWarning}</p>}
          <FieldError message={errors.destination_pool_id} />
        </div>
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
        {isLoading ? "Registrando..." : "Registrar Traslado"}
      </Button>
    </form>
  );
}
