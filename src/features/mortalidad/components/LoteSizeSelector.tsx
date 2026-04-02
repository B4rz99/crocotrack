import { useState } from "react";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";

interface SizeComposition {
  readonly size_inches: number;
  readonly animal_count: number;
}

interface LoteSizeSelectorProps {
  readonly compositions: readonly SizeComposition[];
  readonly onChange: (deaths: ReadonlyArray<{ size_inches: number; animal_count: number }>) => void;
  readonly errors?: Record<string, string>;
}

export function LoteSizeSelector({ compositions, onChange, errors }: LoteSizeSelectorProps) {
  const [counts, setCounts] = useState<Record<number, number>>(() =>
    Object.fromEntries(compositions.map((c) => [c.size_inches, 0]))
  );

  if (compositions.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin composición de tallas disponible.</p>;
  }

  const handleChange = (sizeInches: number, value: number) => {
    const next = { ...counts, [sizeInches]: value };
    setCounts(next);
    onChange(
      Object.entries(next)
        .filter(([, count]) => count > 0)
        .map(([size, count]) => ({ size_inches: Number(size), animal_count: count }))
    );
  };

  return (
    <div className="space-y-3">
      <Label>Bajas por talla</Label>
      {compositions.map((comp) => (
        <div key={comp.size_inches} className="flex items-center gap-3">
          <span className="w-48 text-sm text-muted-foreground">
            {comp.size_inches} pulgadas — {comp.animal_count} disponibles
          </span>
          <Input
            type="number"
            min={0}
            max={comp.animal_count}
            value={counts[comp.size_inches] ?? 0}
            onChange={(e) => handleChange(comp.size_inches, Number(e.target.value))}
            className="w-24"
            aria-label={`Bajas de ${comp.size_inches} pulgadas`}
          />
        </div>
      ))}
      <FieldError message={errors?.compositions} />
    </div>
  );
}
