import { PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { formatDateDisplay } from "@/shared/lib/utils";
import { useTraslados } from "../hooks/useTraslados";

export function TrasladoListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: traslados, isLoading, isError } = useTraslados(farmId);

  const createPath = ROUTES.TRASLADO_CREATE.replace(":farmId", farmId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Traslados</h1>
          <p className="text-sm text-muted-foreground">Movimientos de animales entre piletas</p>
        </div>
        <Button asChild>
          <Link to={createPath}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Nuevo Traslado
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">Cargando traslados...</p>
        </div>
      )}

      {isError && (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-destructive">Error al cargar los traslados.</p>
        </div>
      )}

      {!isLoading && !isError && traslados?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">Sin traslados registrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra el primer movimiento entre piletas.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to={createPath}>Registrar Traslado</Link>
          </Button>
        </div>
      )}

      {!isLoading && !isError && traslados && traslados.length > 0 && (
        <div className="space-y-3">
          {traslados.map((traslado) => (
            <div key={traslado.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {traslado.origin_pool?.name ?? "Pileta desconocida"}
                    {" → "}
                    {traslado.destination_pool?.name ?? "Pileta desconocida"}
                  </p>
                  <p className="text-sm text-muted-foreground">{traslado.total_animals} animales</p>
                  {traslado.profiles?.full_name && (
                    <p className="text-xs text-muted-foreground">
                      Por: {traslado.profiles.full_name}
                    </p>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDateDisplay(traslado.event_date)}
                </span>
              </div>
              {traslado.traslado_size_groups.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {traslado.traslado_size_groups.map((sg) => (
                    <span
                      key={sg.size_inches}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {sg.size_inches}" — {sg.animal_count}
                    </span>
                  ))}
                </div>
              )}
              {traslado.notes && (
                <p className="mt-2 text-xs text-muted-foreground">{traslado.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
