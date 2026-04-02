import { useMemo } from "react";
import { useFarms } from "@/features/farms/hooks/useFarms";
import { FieldError } from "@/shared/components/ui/field-error";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { SizeCompositionItem } from "@/shared/schemas/lote.schema";
import { useOriginPools } from "../hooks/useOriginPools";

interface FincaPropiaFieldsProps {
  readonly currentFarmId: string;
  readonly originFarmId: string | undefined;
  readonly originPoolId: string | undefined;
  readonly onOriginFarmChange: (farmId: string) => void;
  readonly onOriginPoolChange: (poolId: string, compositions: SizeCompositionItem[]) => void;
  readonly errors?: Record<string, string>;
}

const toLoteCompositions = (
  lote:
    | { lote_size_compositions: readonly { size_inches: number; animal_count: number }[] }
    | undefined
): SizeCompositionItem[] =>
  lote?.lote_size_compositions.map(({ size_inches, animal_count }) => ({
    size_inches,
    animal_count,
  })) ?? [];

export function FincaPropiaFields({
  currentFarmId,
  originFarmId,
  originPoolId,
  onOriginFarmChange,
  onOriginPoolChange,
  errors,
}: FincaPropiaFieldsProps) {
  const { data: allFarms, isLoading: farmsLoading } = useFarms();
  const { data: originPools, isLoading: poolsLoading } = useOriginPools(originFarmId);

  const availableFarms = useMemo(
    () => allFarms?.filter((f) => f.id !== currentFarmId && f.is_active) ?? [],
    [allFarms, currentFarmId]
  );

  const selectedPool = useMemo(
    () => originPools?.find((p) => p.id === originPoolId),
    [originPools, originPoolId]
  );
  const activeLote = selectedPool?.lotes[0];
  const availableCompositions = useMemo(() => toLoteCompositions(activeLote), [activeLote]);

  function handleFarmChange(farmId: string | null) {
    if (!farmId) return;
    onOriginFarmChange(farmId);
  }

  function handlePoolChange(poolId: string | null) {
    if (!poolId) return;
    const pool = originPools?.find((p) => p.id === poolId);
    onOriginPoolChange(poolId, toLoteCompositions(pool?.lotes[0]));
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="origin-farm">Granja de origen</Label>
        <Select
          value={originFarmId ?? ""}
          onValueChange={handleFarmChange}
          items={availableFarms.map((f) => ({ value: f.id, label: f.name }))}
        >
          <SelectTrigger id="origin-farm" className="w-full">
            <SelectValue placeholder={farmsLoading ? "Cargando..." : "Seleccionar granja"} />
          </SelectTrigger>
          <SelectContent>
            {availableFarms.map((farm) => (
              <SelectItem key={farm.id} value={farm.id}>
                {farm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError message={errors?.origin_farm_id} />
      </div>

      {originFarmId && (
        <div className="space-y-2">
          <Label htmlFor="origin-pool">Pileta de origen</Label>
          <Select
            value={originPoolId ?? ""}
            onValueChange={handlePoolChange}
            items={(originPools ?? []).map((p) => ({ value: p.id, label: p.name }))}
          >
            <SelectTrigger id="origin-pool" className="w-full">
              <SelectValue
                placeholder={poolsLoading ? "Cargando..." : "Seleccionar pileta con lote activo"}
              />
            </SelectTrigger>
            <SelectContent>
              {(originPools ?? []).map((pool) => (
                <SelectItem key={pool.id} value={pool.id}>
                  {pool.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors?.origin_pool_id} />
        </div>
      )}

      {activeLote && availableCompositions.length > 0 && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <p className="text-sm font-medium">Animales disponibles en origen</p>
          <div className="space-y-1">
            {availableCompositions.map((c) => (
              <div key={c.size_inches} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{c.size_inches}"</span>
                <span>{c.animal_count} animales</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
