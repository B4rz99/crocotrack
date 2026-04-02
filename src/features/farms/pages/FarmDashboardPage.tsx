import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useEntradas } from "@/features/entradas/hooks/useEntradas";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import type { PoolWithLotes } from "../api/pools.api";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { PoolFormModal } from "../components/PoolFormModal";
import { useCreatePool, useDeletePool, useUpdatePool } from "../hooks/usePoolMutations";
import { usePools } from "../hooks/usePools";

type SortKey = "name" | "pool_type" | "capacity";
type SortDir = "asc" | "desc";

const getActiveLote = (pool: PoolWithLotes) =>
  pool.lotes[0] as PoolWithLotes["lotes"][number] | undefined;

const getTotalAnimals = (pool: PoolWithLotes): number | null => {
  const lote = getActiveLote(pool);
  if (!lote) return null;
  return lote.lote_size_compositions.reduce((sum, c) => sum + c.animal_count, 0);
};

const getSizesList = (pool: PoolWithLotes): string => {
  const lote = getActiveLote(pool);
  if (!lote || lote.lote_size_compositions.length === 0) return "";
  return lote.lote_size_compositions.map((c) => `${c.size_inches}"`).join(", ");
};

export function FarmDashboardPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: pools, isLoading: poolsLoading, error: poolsError } = usePools(farmId);
  const { data: entradas } = useEntradas(farmId);

  const createPool = useCreatePool(farmId);
  const updatePool = useUpdatePool(farmId);
  const deletePoolMutation = useDeletePool(farmId);

  const [createPoolOpen, setCreatePoolOpen] = useState(false);
  const [editPool, setEditPool] = useState<{
    id: string;
    name: string;
    pool_type: "crianza" | "reproductor";
    capacity?: number | null;
    code?: string | null;
  } | null>(null);
  const [deletePoolTarget, setDeletePoolTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortedPools = useMemo(
    () =>
      pools
        ? [...pools].sort((a, b) => {
            const aVal = a[sortKey];
            const bVal = b[sortKey];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
            return sortDir === "asc" ? cmp : -cmp;
          })
        : [],
    [pools, sortKey, sortDir]
  );

  // Summary stats derived from existing hook data
  const totalAnimals = pools?.reduce((sum, pool) => sum + (getTotalAnimals(pool) ?? 0), 0) ?? 0;
  const totalPiletas = pools?.length ?? 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentEntradas =
    entradas?.filter((e) => new Date(e.entry_date) >= thirtyDaysAgo).length ?? 0;

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  if (poolsLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (poolsError) {
    return <div className="text-sm text-destructive">Error al cargar datos de la granja.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Animales</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalAnimals}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Piletas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalPiletas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Entradas (30 días)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{recentEntradas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pileta table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Piletas ({sortedPools.length})
          </h2>
          <Button onClick={() => setCreatePoolOpen(true)} size="sm">
            <PlusIcon className="mr-1 size-4" />
            Crear Pileta
          </Button>
        </div>

        {sortedPools.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Nombre{sortIndicator("name")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("pool_type")}
                >
                  Tipo{sortIndicator("pool_type")}
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("capacity")}
                >
                  Capacidad{sortIndicator("capacity")}
                </TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Animales</TableHead>
                <TableHead>Tamaños</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPools.map((pool) => {
                const hasActiveLote = !!getActiveLote(pool);
                const totalPoolAnimals = getTotalAnimals(pool);
                const sizes = getSizesList(pool);

                return (
                  <TableRow key={pool.id}>
                    <TableCell className="font-medium">{pool.name}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          pool.pool_type === "reproductor"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {pool.pool_type === "reproductor" ? "Reproductor" : "Crianza"}
                      </span>
                    </TableCell>
                    <TableCell>{pool.capacity ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          hasActiveLote
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {hasActiveLote ? "Con lote" : "Vacía"}
                      </span>
                    </TableCell>
                    <TableCell>{totalPoolAnimals ?? "—"}</TableCell>
                    <TableCell>{sizes || "—"}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Acciones de pileta"
                            />
                          }
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              setEditPool({
                                id: pool.id,
                                name: pool.name,
                                pool_type: pool.pool_type,
                                capacity: pool.capacity,
                                code: pool.code,
                              })
                            }
                          >
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletePoolTarget({ id: pool.id, name: pool.name })}
                          >
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">No hay piletas creadas.</p>
        )}
      </div>

      {/* Pool modals */}
      <PoolFormModal
        open={createPoolOpen}
        onOpenChange={setCreatePoolOpen}
        isLoading={createPool.isPending}
        onSubmit={(data) => {
          createPool.mutate(data, {
            onSuccess: () => setCreatePoolOpen(false),
          });
        }}
      />

      <PoolFormModal
        open={!!editPool}
        onOpenChange={(open) => {
          if (!open) setEditPool(null);
        }}
        pool={editPool}
        isLoading={updatePool.isPending}
        onSubmit={(data) => {
          if (!editPool) return;
          updatePool.mutate(
            { poolId: editPool.id, input: data },
            { onSuccess: () => setEditPool(null) }
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deletePoolTarget}
        onOpenChange={(open) => {
          if (!open) setDeletePoolTarget(null);
        }}
        title="Eliminar Pileta"
        description={`¿Estás seguro de eliminar "${deletePoolTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deletePoolMutation.isPending}
        onConfirm={() => {
          if (!deletePoolTarget) return;
          deletePoolMutation.mutate(deletePoolTarget.id, {
            onSuccess: () => setDeletePoolTarget(null),
          });
        }}
      />
    </div>
  );
}
