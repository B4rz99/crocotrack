import { ArrowLeftIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
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
import { ROUTES } from "@/shared/constants/routes";
import type { PoolWithLotes } from "../api/pools.api";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { FarmFormModal } from "../components/FarmFormModal";
import { PoolFormModal } from "../components/PoolFormModal";
import { useFarm } from "../hooks/useFarm";
import { useDeleteFarm, useUpdateFarm } from "../hooks/useFarmMutations";
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

export function FarmDetailPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: farm, isLoading: farmLoading, error: farmError } = useFarm(farmId);
  const { data: pools, isLoading: poolsLoading, error: poolsError } = usePools(farmId);

  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();
  const createPool = useCreatePool(farmId);
  const updatePool = useUpdatePool(farmId);
  const deletePoolMutation = useDeletePool(farmId);

  const [editFarmOpen, setEditFarmOpen] = useState(false);
  const [deleteFarmOpen, setDeleteFarmOpen] = useState(false);
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

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

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

  if (farmLoading || poolsLoading) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (farmError || poolsError) {
    return <div className="text-sm text-destructive">Error al cargar datos de la granja.</div>;
  }

  if (!farm) {
    return <div className="text-sm text-destructive">Granja no encontrada.</div>;
  }

  const sortIndicator = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={ROUTES.FARMS}>
          <Button variant="ghost" size="icon-sm" aria-label="Volver a granjas">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="flex-1 text-xl font-bold">{farm.name}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" aria-label="Acciones de granja" />}
          >
            <MoreHorizontalIcon className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditFarmOpen(true)}>Editar Granja</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDeleteFarmOpen(true)}>
              Eliminar Granja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
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
              const totalAnimals = getTotalAnimals(pool);
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
                        hasActiveLote ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {hasActiveLote ? "Con lote" : "Vacía"}
                    </span>
                  </TableCell>
                  <TableCell>{totalAnimals ?? "—"}</TableCell>
                  <TableCell>{sizes || "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Acciones de pileta" />
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

      {/* Farm modals */}
      <FarmFormModal
        open={editFarmOpen}
        onOpenChange={setEditFarmOpen}
        farm={farm}
        isLoading={updateFarm.isPending}
        onSubmit={(data) => {
          updateFarm.mutate({ farmId, input: data }, { onSuccess: () => setEditFarmOpen(false) });
        }}
      />

      <DeleteConfirmDialog
        open={deleteFarmOpen}
        onOpenChange={setDeleteFarmOpen}
        title="Eliminar Granja"
        description={`¿Estás seguro de eliminar "${farm.name}"? Esta acción se puede revertir.`}
        isLoading={deleteFarmMutation.isPending}
        onConfirm={() => {
          deleteFarmMutation.mutate(farmId, {
            onSuccess: () => navigate(ROUTES.FARMS),
          });
        }}
      />

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
