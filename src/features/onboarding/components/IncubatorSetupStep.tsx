import { type FormEvent, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { CreateIncubatorInput } from "@/shared/schemas/incubator.schema";

interface IncubatorSetupStepProps {
  readonly onNext: (data: readonly CreateIncubatorInput[]) => void;
  readonly onBack: () => void;
}

export function IncubatorSetupStep({ onNext, onBack }: IncubatorSetupStepProps) {
  const [enabled, setEnabled] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [capacity, setCapacity] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const incubatorCount = (() => {
    const qty = Number(quantity) || 0;
    const cap = Number(capacity) || 0;
    return qty > 0 && cap > 0 ? qty : 0;
  })();

  function buildIncubators(): readonly CreateIncubatorInput[] {
    const qty = Number(quantity) || 0;
    const cap = Number(capacity) || 0;
    return Array.from({ length: qty }, (_, i) => ({
      name: String(i + 1),
      capacity: cap,
    }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!enabled) {
      onNext([]);
      return;
    }

    setErrors({});
    const newErrors: Record<string, string> = {};
    const qty = Number(quantity);
    const cap = Number(capacity);

    if (!Number.isInteger(qty) || qty <= 0) {
      newErrors.quantity = "Ingresa la cantidad de incubadoras";
    }
    if (!Number.isInteger(cap) || cap <= 0) {
      newErrors.capacity = "Ingresa la capacidad por incubadora";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onNext(buildIncubators());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id="enable-incubators"
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="size-4 rounded border-input"
        />
        <Label htmlFor="enable-incubators">Habilitar configuración de incubadoras</Label>
      </div>

      {enabled && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="incubator-qty">Cantidad de incubadoras</Label>
              <Input
                id="incubator-qty"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="5"
                aria-invalid={!!errors.quantity}
              />
              <FieldError message={errors.quantity} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="incubator-cap">Capacidad por incubadora</Label>
              <Input
                id="incubator-cap"
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="500"
                aria-invalid={!!errors.capacity}
              />
              <FieldError message={errors.capacity} />
            </div>
          </div>

          {incubatorCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {`Se ${incubatorCount === 1 ? "creará" : "crearán"} ${incubatorCount} ${incubatorCount === 1 ? "incubadora" : "incubadoras"}`}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="submit">Siguiente</Button>
      </div>
    </form>
  );
}
