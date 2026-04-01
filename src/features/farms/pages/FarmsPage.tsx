import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { ROUTES } from "@/shared/constants/routes";
import { DeleteConfirmDialog } from "../components/DeleteConfirmDialog";
import { FarmFormModal } from "../components/FarmFormModal";
import { useCreateFarm, useDeleteFarm, useUpdateFarm } from "../hooks/useFarmMutations";
import { useFarms } from "../hooks/useFarms";

export function FarmsPage() {
  const { data: farms, isPending, error } = useFarms();
  const createFarm = useCreateFarm();
  const updateFarm = useUpdateFarm();
  const deleteFarmMutation = useDeleteFarm();

  const [createOpen, setCreateOpen] = useState(false);
  const [editFarm, setEditFarm] = useState<{
    id: string;
    name: string;
    location?: string | null;
  } | null>(null);
  const [deleteFarmTarget, setDeleteFarmTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);

  if (isPending) {
    return <div className="text-sm text-muted-foreground">Cargando...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error al cargar granjas.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Granjas</h1>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <PlusIcon className="mr-1 size-4" />
          Crear Granja
        </Button>
      </div>

      {farms && farms.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {farms.map((farm) => (
            <li key={farm.id} className="flex items-center justify-between px-4 py-3">
              <Link
                to={ROUTES.FARM_DETAIL.replace(":farmId", farm.id)}
                className="text-sm font-medium hover:underline"
              >
                {farm.name}
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label="Acciones" />}
                >
                  <MoreHorizontalIcon className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      setEditFarm({
                        id: farm.id,
                        name: farm.name,
                        location: farm.location,
                      })
                    }
                  >
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      setDeleteFarmTarget({
                        id: farm.id,
                        name: farm.name,
                      })
                    }
                  >
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No hay granjas creadas.</p>
      )}

      <FarmFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        isLoading={createFarm.isPending}
        onSubmit={(data) => {
          createFarm.mutate(data, {
            onSuccess: () => setCreateOpen(false),
          });
        }}
      />

      <FarmFormModal
        open={!!editFarm}
        onOpenChange={(open) => {
          if (!open) setEditFarm(null);
        }}
        farm={editFarm}
        isLoading={updateFarm.isPending}
        onSubmit={(data) => {
          if (!editFarm) return;
          updateFarm.mutate(
            { farmId: editFarm.id, input: data },
            { onSuccess: () => setEditFarm(null) }
          );
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteFarmTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteFarmTarget(null);
        }}
        title="Eliminar Granja"
        description={`¿Estás seguro de eliminar "${deleteFarmTarget?.name}"? Esta acción se puede revertir.`}
        isLoading={deleteFarmMutation.isPending}
        onConfirm={() => {
          if (!deleteFarmTarget) return;
          deleteFarmMutation.mutate(deleteFarmTarget.id, {
            onSuccess: () => setDeleteFarmTarget(null),
          });
        }}
      />
    </div>
  );
}
