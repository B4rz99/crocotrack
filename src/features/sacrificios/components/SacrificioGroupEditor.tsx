import { ChevronDownIcon, ChevronRightIcon, PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
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
import type { SacrificioGroupInput } from "@/shared/schemas/sacrificio.schema";

interface SacrificioGroupEditorProps {
  readonly loteTotal: number;
  readonly destinationPools: readonly PoolWithLotes[];
  readonly onChange: (groups: readonly SacrificioGroupInput[]) => void;
  readonly errors?: Record<string, string>;
  readonly groupErrors?: Record<number, Record<string, string>>;
}

type DraftRejected = {
  animal_count: string;
  destination_pool_id: string;
};

type DraftGroup = {
  size_inches: string;
  sacrificed_count: string;
  rejected: DraftRejected[];
  expanded: boolean;
};

function emptyGroup(): DraftGroup {
  return { size_inches: "", sacrificed_count: "", rejected: [], expanded: false };
}

function emptyRejected(): DraftRejected {
  return { animal_count: "", destination_pool_id: "" };
}

function toGroupInputs(drafts: readonly DraftGroup[]): readonly SacrificioGroupInput[] {
  return drafts.flatMap((d) => {
    const size = Number.parseInt(d.size_inches, 10);
    const sacrificed = Number.parseInt(d.sacrificed_count, 10);
    if (Number.isNaN(size)) return [];
    const rejected = d.rejected.flatMap((r) => {
      const count = Number.parseInt(r.animal_count, 10);
      if (Number.isNaN(count) || count <= 0 || !r.destination_pool_id) return [];
      return [{ animal_count: count, destination_pool_id: r.destination_pool_id }];
    });
    return [
      {
        size_inches: size,
        sacrificed_count: Number.isNaN(sacrificed) ? 0 : sacrificed,
        rejected,
      },
    ];
  });
}

function poolLabel(pool: PoolWithLotes): string {
  const loteTotalAnimals = pool.lotes[0]?.lote_size_compositions.reduce(
    (sum, c) => sum + c.animal_count,
    0
  );
  return loteTotalAnimals !== undefined ? `${pool.name} (${loteTotalAnimals})` : pool.name;
}

export function SacrificioGroupEditor({
  loteTotal,
  destinationPools,
  onChange,
  errors = {},
  groupErrors = {},
}: SacrificioGroupEditorProps) {
  const [drafts, setDrafts] = useState<readonly DraftGroup[]>([emptyGroup()]);

  const totalSacrificed = drafts.reduce((sum, d) => {
    const n = Number.parseInt(d.sacrificed_count, 10);
    return sum + (Number.isNaN(n) ? 0 : n);
  }, 0);

  const totalRejected = drafts.reduce(
    (sum, d) =>
      sum +
      d.rejected.reduce((rs, r) => {
        const n = Number.parseInt(r.animal_count, 10);
        return rs + (Number.isNaN(n) ? 0 : n);
      }, 0),
    0
  );

  const totalProcessed = totalSacrificed + totalRejected;
  const faltantes = loteTotal - totalProcessed;

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

  function toggleExpanded(index: number) {
    const group = drafts[index];
    if (!group) return;
    updateDraft(index, { expanded: !group.expanded });
  }

  function addRejected(groupIndex: number) {
    const group = drafts[groupIndex];
    if (!group) return;
    updateDraft(groupIndex, {
      rejected: [...group.rejected, emptyRejected()],
      expanded: true,
    });
  }

  function updateRejected(groupIndex: number, rejIndex: number, patch: Partial<DraftRejected>) {
    const group = drafts[groupIndex];
    if (!group) return;
    const newRejected = group.rejected.map((r, i) => (i === rejIndex ? { ...r, ...patch } : r));
    updateDraft(groupIndex, { rejected: newRejected });
  }

  function removeRejected(groupIndex: number, rejIndex: number) {
    const group = drafts[groupIndex];
    if (!group) return;
    updateDraft(groupIndex, {
      rejected: group.rejected.filter((_, i) => i !== rejIndex),
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Grupos de talla medidos</Label>
        <p className="text-xs text-muted-foreground">
          La talla es la medición en el momento del proceso; puede ser distinta a las tallas
          registradas antes en el inventario del lote.
        </p>
      </div>

      {drafts.map((draft, index) => {
        const rowErrors = groupErrors[index] ?? {};
        const hasRejected = draft.rejected.length > 0;

        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: draft list has no stable keys
          <div key={index} className="rounded-lg border bg-card p-3 space-y-3">
            <div className="flex gap-2 items-start">
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
                  placeholder="16"
                  value={draft.size_inches}
                  aria-invalid={!!rowErrors.size_inches}
                  onChange={(e) => updateDraft(index, { size_inches: e.target.value })}
                />
                <FieldError message={rowErrors.size_inches} />
              </div>

              <div className="flex-none w-28 space-y-1">
                {index === 0 && (
                  <Label htmlFor={`sacrificed-${index}`} className="text-xs text-muted-foreground">
                    Sacrificados
                  </Label>
                )}
                <Input
                  id={`sacrificed-${index}`}
                  type="number"
                  min={0}
                  placeholder="40"
                  value={draft.sacrificed_count}
                  aria-invalid={!!rowErrors.sacrificed_count}
                  onChange={(e) => updateDraft(index, { sacrificed_count: e.target.value })}
                />
                <FieldError message={rowErrors.sacrificed_count} />
              </div>

              <div className="flex-1 flex items-center gap-1">
                {index === 0 && <div className="h-5" />}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={index === 0 ? "mt-5" : ""}
                  onClick={() => {
                    if (hasRejected) {
                      toggleExpanded(index);
                    } else {
                      addRejected(index);
                    }
                  }}
                >
                  {hasRejected ? (
                    <>
                      {draft.expanded ? (
                        <ChevronDownIcon className="mr-1 size-3" />
                      ) : (
                        <ChevronRightIcon className="mr-1 size-3" />
                      )}
                      Rechazados ({draft.rejected.length})
                    </>
                  ) : (
                    <>
                      <PlusIcon className="mr-1 size-3" />
                      Rechazados
                    </>
                  )}
                </Button>
              </div>

              <div className={index === 0 ? "mt-5" : ""}>
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

            {draft.expanded && draft.rejected.length > 0 && (
              <div className="ml-4 space-y-2 border-l-2 border-muted pl-3">
                {draft.rejected.map((rej, rejIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: draft list has no stable keys
                  <div key={rejIndex} className="flex gap-2 items-start">
                    <div className="flex-none w-24 space-y-1">
                      {rejIndex === 0 && (
                        <span className="text-xs text-muted-foreground">Cantidad</span>
                      )}
                      <Input
                        type="number"
                        min={1}
                        placeholder="10"
                        value={rej.animal_count}
                        onChange={(e) =>
                          updateRejected(index, rejIndex, { animal_count: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      {rejIndex === 0 && (
                        <span className="text-xs text-muted-foreground">Pileta destino</span>
                      )}
                      <Select
                        value={rej.destination_pool_id}
                        onValueChange={(val) => {
                          if (val) updateRejected(index, rejIndex, { destination_pool_id: val });
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {() => {
                              const pool = destinationPools.find(
                                (p) => p.id === rej.destination_pool_id
                              );
                              return pool ? poolLabel(pool) : "Seleccionar pileta";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {destinationPools.map((pool) => (
                            <SelectItem key={pool.id} value={pool.id}>
                              {poolLabel(pool)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={rejIndex === 0 ? "mt-5" : ""}
                      aria-label="Eliminar rechazo"
                      onClick={() => removeRejected(index, rejIndex)}
                    >
                      <XIcon className="size-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="ghost" size="sm" onClick={() => addRejected(index)}>
                  <PlusIcon className="mr-1 size-3" />
                  Agregar destino
                </Button>
              </div>
            )}
          </div>
        );
      })}

      {errors.groups && <FieldError message={errors.groups} />}

      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
        <PlusIcon className="mr-1 size-4" />
        Agregar talla
      </Button>

      <div className="rounded-lg border bg-muted/50 p-4 space-y-1">
        <div className="flex justify-between text-sm">
          <span>Total sacrificados</span>
          <span className="font-medium">{totalSacrificed}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total rechazados</span>
          <span className="font-medium">{totalRejected}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Total procesados</span>
          <span className="font-medium">
            {totalProcessed} / {loteTotal}
          </span>
        </div>
        {faltantes > 0 && (
          <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400 font-medium">
            <span>Faltantes ⚠</span>
            <span>{faltantes}</span>
          </div>
        )}
        {totalProcessed > loteTotal && (
          <p className="text-sm text-destructive font-medium">
            El total procesado excede el inventario del lote
          </p>
        )}
      </div>
    </div>
  );
}
