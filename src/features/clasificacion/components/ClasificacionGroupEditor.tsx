import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import type { PoolWithLotes } from "@/features/farms/api/pools.api";
import { PoolCombobox } from "@/features/farms/components/PoolCombobox";
import { Button } from "@/shared/components/ui/button";
import { FieldError } from "@/shared/components/ui/field-error";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import type { ClasificacionGroupInput } from "@/shared/schemas/clasificacion.schema";

interface ClasificacionGroupEditorProps {
  readonly originTotal: number;
  readonly destinationPools: readonly PoolWithLotes[];
  readonly onChange: (groups: readonly ClasificacionGroupInput[]) => void;
  /** Top-level errors (e.g. errors.groups for "at least one group" message) */
  readonly errors?: Record<string, string>;
  /** Per-row, per-field errors keyed by row index then field name */
  readonly groupErrors?: Record<number, Record<string, string>>;
}

type DraftGroup = {
  size_inches: string;
  animal_count: string;
  destination_pool_id: string;
};

function emptyGroup(): DraftGroup {
  return { size_inches: "", animal_count: "", destination_pool_id: "" };
}

function toGroupInputs(drafts: readonly DraftGroup[]): readonly ClasificacionGroupInput[] {
  return drafts.flatMap((d) => {
    const size = Number.parseInt(d.size_inches, 10);
    const count = Number.parseInt(d.animal_count, 10);
    if (!d.destination_pool_id || Number.isNaN(size) || Number.isNaN(count)) return [];
    return [{ size_inches: size, animal_count: count, destination_pool_id: d.destination_pool_id }];
  });
}

function poolLabel(pool: PoolWithLotes): string {
  const loteTotal = pool.lotes[0]?.lote_size_compositions.reduce(
    (sum, c) => sum + c.animal_count,
    0
  );
  return loteTotal !== undefined ? `${pool.name} (${loteTotal} animales)` : pool.name;
}

export function ClasificacionGroupEditor({
  originTotal,
  destinationPools,
  onChange,
  errors = {},
  groupErrors = {},
}: ClasificacionGroupEditorProps) {
  const [drafts, setDrafts] = useState<readonly DraftGroup[]>([emptyGroup()]);

  const classifiedTotal = drafts.reduce((sum, d) => {
    const n = Number.parseInt(d.animal_count, 10);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);

  // Warn whenever classified total doesn't match origin total,
  // including when originTotal is 0 (e.g. empty lote compositions).
  const hasMismatch = classifiedTotal !== originTotal;

  function commitDrafts(next: readonly DraftGroup[]) {
    setDrafts(next);
    onChange(toGroupInputs(next));
  }

  function updateDraft(index: number, patch: Partial<DraftGroup>) {
    commitDrafts(drafts.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addGroup() {
    commitDrafts([...drafts, emptyGroup()]);
  }

  function removeGroup(index: number) {
    if (drafts.length <= 1) return;
    commitDrafts(drafts.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Grupos de clasificación</Label>
        <span
          className={`text-sm font-medium ${
            hasMismatch ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          }`}
        >
          Clasificados: {classifiedTotal} / {originTotal} total
          {hasMismatch && " ⚠"}
        </span>
      </div>

      {drafts.map((draft, index) => {
        const rowErrors = groupErrors[index] ?? {};
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: draft list has no stable keys
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-none w-24 space-y-1">
              {index === 0 && (
                <Label htmlFor={`size-${index}`} className="text-xs text-muted-foreground">
                  Talla (pulg.)
                </Label>
              )}
              <Input
                id={`size-${index}`}
                type="number"
                min={1}
                placeholder="12"
                value={draft.size_inches}
                aria-invalid={!!rowErrors.size_inches}
                onChange={(e) => updateDraft(index, { size_inches: e.target.value })}
              />
              <FieldError message={rowErrors.size_inches} />
            </div>

            <div className="flex-none w-24 space-y-1">
              {index === 0 && (
                <Label htmlFor={`count-${index}`} className="text-xs text-muted-foreground">
                  Cantidad
                </Label>
              )}
              <Input
                id={`count-${index}`}
                type="number"
                min={1}
                placeholder="50"
                value={draft.animal_count}
                aria-invalid={!!rowErrors.animal_count}
                onChange={(e) => updateDraft(index, { animal_count: e.target.value })}
              />
              <FieldError message={rowErrors.animal_count} />
            </div>

            <div className="flex-1 space-y-1">
              {index === 0 && (
                <Label htmlFor={`dest-${index}`} className="text-xs text-muted-foreground">
                  Pileta destino
                </Label>
              )}
              <PoolCombobox
                id={`dest-${index}`}
                pools={destinationPools}
                value={draft.destination_pool_id}
                onChange={(id) => updateDraft(index, { destination_pool_id: id })}
                getOptionLabel={poolLabel}
                showCodeHint={false}
                error={rowErrors.destination_pool_id}
              />
              <FieldError message={rowErrors.destination_pool_id} />
            </div>

            <div className={index === 0 ? "mt-6" : ""}>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Eliminar grupo"
                disabled={drafts.length <= 1}
                onClick={() => removeGroup(index)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {errors.groups && <FieldError message={errors.groups} />}

      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
        <PlusIcon className="mr-1 size-4" />
        Agregar grupo
      </Button>
    </div>
  );
}
