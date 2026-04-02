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
import type { CreateAlimentacionInput } from "@/shared/schemas/alimentacion.schema";
import { createAlimentacionSchema } from "@/shared/schemas/alimentacion.schema";

interface FoodType {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
}

interface FoodStockItem {
  readonly food_type_id: string;
  readonly current_quantity: number;
}

interface AlimentacionFormProps {
  readonly pools: readonly PoolWithLotes[];
  readonly foodTypes: readonly FoodType[];
  readonly foodStock: readonly FoodStockItem[];
  readonly isLoading?: boolean;
  readonly onSubmit: (data: CreateAlimentacionInput) => void;
}

export function AlimentacionForm({
  pools,
  foodTypes,
  foodStock,
  isLoading = false,
  onSubmit,
}: AlimentacionFormProps) {
  const [poolId, setPoolId] = useState("");
  const [foodTypeId, setFoodTypeId] = useState("");
  const [eventDate, setEventDate] = useState(todayIsoDate);
  const [quantityKg, setQuantityKg] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedPool = pools.find((p) => p.id === poolId);
  const selectedFoodType = foodTypes.find((ft) => ft.id === foodTypeId);
  const stockForType = foodStock.find((s) => s.food_type_id === foodTypeId);
  const currentStock = stockForType?.current_quantity ?? 0;
  const quantity = Number(quantityKg) || 0;
  const stockWarning = foodTypeId && quantity > 0 && quantity > currentStock;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const raw = {
      pool_id: poolId,
      food_type_id: foodTypeId,
      event_date: eventDate,
      quantity_kg: quantity,
      notes: notes || undefined,
    };

    const result = createAlimentacionSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="event-date">Fecha</Label>
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
        <Select value={poolId} onValueChange={(v) => v && setPoolId(v)}>
          <SelectTrigger id="pool-select" className="w-full" aria-invalid={!!errors.pool_id}>
            <SelectValue>{() => selectedPool?.name ?? "Seleccionar pileta"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {pools.map((pool) => (
              <SelectItem key={pool.id} value={pool.id}>
                {pool.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors.pool_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="food-type-select">Tipo de alimento</Label>
        <Select value={foodTypeId} onValueChange={(v) => v && setFoodTypeId(v)}>
          <SelectTrigger
            id="food-type-select"
            className="w-full"
            aria-invalid={!!errors.food_type_id}
          >
            <SelectValue>
              {() => selectedFoodType?.name ?? "Seleccionar tipo de alimento"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {foodTypes.map((ft) => (
              <SelectItem key={ft.id} value={ft.id}>
                {ft.name} ({ft.unit})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {foodTypeId && (
          <p className="text-sm text-muted-foreground">Stock actual: {currentStock} kg</p>
        )}
        <FieldError message={errors.food_type_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="quantity-kg">Cantidad (kg)</Label>
        <Input
          id="quantity-kg"
          type="number"
          step="0.01"
          min="0.01"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
          placeholder="Ej: 25.5"
          aria-invalid={!!errors.quantity_kg}
        />
        {stockWarning && (
          <p className="text-sm text-amber-600">
            La cantidad excede el stock registrado ({currentStock} kg disponibles).
          </p>
        )}
        <FieldError message={errors.quantity_kg} />
      </div>

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
        {isLoading ? "Registrando..." : "Registrar Alimentacion"}
      </Button>
    </form>
  );
}
