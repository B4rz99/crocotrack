import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { generateId } from "@/shared/lib/utils";
import type { SizeCompositionItem } from "@/shared/schemas/lote.schema";

interface SizeGroupEditorProps {
  readonly groups: SizeCompositionItem[];
  readonly onChange: (groups: SizeCompositionItem[]) => void;
  readonly errors?: Record<string, string>;
  readonly maxForSize?: Record<number, number>;
}

export function SizeGroupEditor({ groups, onChange, errors, maxForSize }: SizeGroupEditorProps) {
  const [keys, setKeys] = useState<string[]>(() => groups.map(() => generateId()));

  // Sync keys when groups length changes from outside (e.g. finca_propia pre-population)
  useEffect(() => {
    setKeys((prev) => {
      if (prev.length === groups.length) return prev;
      return Array.from({ length: groups.length }, (_, i) => prev[i] ?? generateId());
    });
  }, [groups.length]);

  const totalAnimals = groups.reduce((sum, g) => sum + (g.animal_count || 0), 0);

  function handleSizeChange(index: number, value: string) {
    const parsed = Number.parseInt(value, 10);
    onChange(
      groups.map((g, i) =>
        i === index ? { ...g, size_inches: Number.isNaN(parsed) ? 0 : parsed } : g
      )
    );
  }

  function handleCountChange(index: number, value: string) {
    const parsed = Number.parseInt(value, 10);
    onChange(
      groups.map((g, i) =>
        i === index ? { ...g, animal_count: Number.isNaN(parsed) ? 0 : parsed } : g
      )
    );
  }

  function handleRemove(index: number) {
    setKeys((prev) => prev.filter((_, i) => i !== index));
    onChange(groups.filter((_, i) => i !== index));
  }

  function handleAdd() {
    setKeys((prev) => [...prev, generateId()]);
    onChange([...groups, { size_inches: 0, animal_count: 0 }]);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Grupos de talla</Label>
        <span className="text-sm text-muted-foreground">Total: {totalAnimals} animales</span>
      </div>

      {groups.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
            <span>Talla (pulgadas)</span>
            <span>Cantidad</span>
            <span />
          </div>
          {groups.map((group, index) => {
            const rowKey = keys[index] ?? String(index);
            const maxCount = group.size_inches ? maxForSize?.[group.size_inches] : undefined;
            const overMax =
              maxCount !== undefined && group.animal_count > maxCount && group.animal_count > 0;

            return (
              <div key={rowKey} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={group.size_inches || ""}
                    onChange={(e) => handleSizeChange(index, e.target.value)}
                    placeholder="Ej. 12"
                    aria-label={`Talla grupo ${index + 1}`}
                    aria-invalid={!!errors?.[`compositions.${index}.size_inches`]}
                  />
                  <FieldError message={errors?.[`compositions.${index}.size_inches`]} />
                </div>
                <div className="space-y-1">
                  <Input
                    type="number"
                    min="1"
                    value={group.animal_count || ""}
                    onChange={(e) => handleCountChange(index, e.target.value)}
                    placeholder="Cantidad"
                    aria-label={`Cantidad grupo ${index + 1}`}
                    aria-invalid={!!errors?.[`compositions.${index}.animal_count`] || overMax}
                  />
                  {maxCount !== undefined && (
                    <p className="text-xs text-muted-foreground">Disponible: {maxCount}</p>
                  )}
                  {overMax && (
                    <p className="text-xs text-destructive">Excede el disponible ({maxCount})</p>
                  )}
                  <FieldError message={errors?.[`compositions.${index}.animal_count`]} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleRemove(index)}
                  aria-label={`Eliminar grupo ${index + 1}`}
                  className="mt-0.5"
                >
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {errors?.compositions && <FieldError message={errors.compositions} />}

      <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
        <PlusIcon className="mr-1 size-4" />
        Agregar grupo
      </Button>
    </div>
  );
}
