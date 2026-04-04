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
import type { CreateLimpiezaInput } from "@/shared/schemas/limpieza.schema";
import { createLimpiezaSchema } from "@/shared/schemas/limpieza.schema";
import type { CleaningProductType } from "../api/cleaning-product-types.api";
import { CleaningProductSelector } from "./CleaningProductSelector";

interface LimpiezaFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly cleaningProductTypes: readonly CleaningProductType[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: CreateLimpiezaInput) => void;
}

export function LimpiezaForm({
  pools,
  cleaningProductTypes,
  isLoading = false,
  onSubmit,
}: LimpiezaFormProps) {
  const [poolId, setPoolId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [products, setProducts] = useState<
    ReadonlyArray<{ cleaning_product_type_id: string; quantity: number }>
  >([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const activePools = pools.filter((p) => p.is_active);
  const selectedPool = activePools.find((p) => p.id === poolId);

  function handlePoolChange(value: string | null) {
    if (!value) return;
    setPoolId(value);
    setErrors({});
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const raw = {
      pool_id: poolId,
      event_date: eventDate,
      products,
      notes: notes || undefined,
    };

    const result = createLimpiezaSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-date">Fecha de ejecución</Label>
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
            {activePools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {activePools.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay piletas activas.</p>
        )}
        <FieldError message={errors.pool_id} />
      </div>

      <CleaningProductSelector
        productTypes={[...cleaningProductTypes]}
        onChange={setProducts}
        errors={errors}
      />

      <div className="space-y-2">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Observaciones adicionales..."
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Registrando..." : "Registrar Limpieza"}
      </Button>
    </form>
  );
}
