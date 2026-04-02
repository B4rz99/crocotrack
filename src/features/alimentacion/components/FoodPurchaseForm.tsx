import { type FormEvent, useState } from "react";
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
import type { CreateFoodPurchaseInput } from "@/shared/schemas/alimentacion.schema";
import { createFoodPurchaseSchema } from "@/shared/schemas/alimentacion.schema";
import type { FoodType } from "../types";

interface FoodPurchaseFormProps {
  readonly foodTypes: readonly FoodType[];
  readonly defaultFoodTypeId?: string;
  readonly isLoading?: boolean;
  readonly onSubmit: (data: CreateFoodPurchaseInput) => void;
}

export function FoodPurchaseForm({
  foodTypes,
  defaultFoodTypeId = "",
  isLoading = false,
  onSubmit,
}: FoodPurchaseFormProps) {
  const [foodTypeId, setFoodTypeId] = useState(defaultFoodTypeId);
  const [purchaseDate, setPurchaseDate] = useState(todayIsoDate);
  const [quantityKg, setQuantityKg] = useState("");
  const [supplier, setSupplier] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedFoodType = foodTypes.find((ft) => ft.id === foodTypeId);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    const raw = {
      food_type_id: foodTypeId,
      purchase_date: purchaseDate,
      quantity_kg: Number(quantityKg) || 0,
      supplier: supplier || undefined,
      notes: notes || undefined,
    };

    const result = createFoodPurchaseSchema.safeParse(raw);

    if (!result.success) {
      setErrors(zodFieldErrors(result.error));
      return;
    }

    onSubmit(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="purchase-date">Fecha de compra</Label>
        <Input
          id="purchase-date"
          type="date"
          value={purchaseDate}
          onChange={(e) => setPurchaseDate(e.target.value)}
          aria-invalid={!!errors.purchase_date}
        />
        <FieldError message={errors.purchase_date} />
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
        <FieldError message={errors.food_type_id} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purchase-quantity">Cantidad (kg)</Label>
        <Input
          id="purchase-quantity"
          type="number"
          step="0.01"
          min="0.01"
          value={quantityKg}
          onChange={(e) => setQuantityKg(e.target.value)}
          placeholder="Ej: 100"
          aria-invalid={!!errors.quantity_kg}
        />
        <FieldError message={errors.quantity_kg} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="supplier">Proveedor (opcional)</Label>
        <Input
          id="supplier"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Nombre del proveedor"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="purchase-notes">Notas (opcional)</Label>
        <textarea
          id="purchase-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
          placeholder="Observaciones adicionales..."
        />
      </div>

      <Button type="submit" disabled={isLoading} className="w-full">
        {isLoading ? "Registrando..." : "Registrar Compra"}
      </Button>
    </form>
  );
}
