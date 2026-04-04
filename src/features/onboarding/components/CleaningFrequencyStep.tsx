import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface CleaningFrequencyStepProps {
  readonly onNext: (days: number | null) => void;
  readonly onBack: () => void;
}

export function CleaningFrequencyStep({ onNext, onBack }: CleaningFrequencyStepProps) {
  const [days, setDays] = useState("");

  function handleNext() {
    const parsed = Number.parseInt(days, 10);
    onNext(parsed > 0 ? parsed : null);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="frequency-days">¿Cada cuántos días se deben limpiar las piletas?</Label>
        <Input
          id="frequency-days"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Ej: 90 (cada 3 meses)"
        />
        <p className="text-sm text-muted-foreground">
          Déjalo vacío si no deseas configurar alertas de limpieza por ahora.
        </p>
      </div>

      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Atrás
        </Button>
        <Button type="button" onClick={handleNext}>
          Siguiente
        </Button>
      </div>
    </div>
  );
}
