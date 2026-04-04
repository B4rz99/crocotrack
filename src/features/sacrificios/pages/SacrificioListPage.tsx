import { PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { formatDateDisplay } from "@/shared/lib/utils";
import { useSacrificios } from "../hooks/useSacrificios";

export function SacrificioListPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const { data: sacrificios, isLoading, isError } = useSacrificios(farmId);

  const createPath = ROUTES.SACRIFICIO_CREATE.replace(":farmId", farmId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando sacrificios...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">Error al cargar los sacrificios.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sacrificios</h1>
          <p className="text-sm text-muted-foreground">
            Registro de procesos de sacrificio por pileta
          </p>
        </div>
        <Link to={createPath}>
          <Button>
            <PlusIcon className="mr-2 h-4 w-4" />
            Nuevo Sacrificio
          </Button>
        </Link>
      </div>

      {sacrificios?.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">Sin sacrificios registrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Registra el primer proceso de sacrificio.
          </p>
          <Link to={createPath}>
            <Button className="mt-4" variant="outline">
              Registrar Sacrificio
            </Button>
          </Link>
        </div>
      )}

      {sacrificios && sacrificios.length > 0 && (
        <div className="space-y-3">
          {sacrificios.map((sacrificio) => {
            const detailPath = ROUTES.SACRIFICIO_DETAIL.replace(":farmId", farmId).replace(
              ":sacrificioId",
              sacrificio.id
            );
            return (
              <Link key={sacrificio.id} to={detailPath} className="block">
                <div className="rounded-lg border bg-card p-4 shadow-sm hover:bg-accent/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        {sacrificio.pools?.name ?? "Pileta desconocida"}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>{sacrificio.total_sacrificed} sacrificados</span>
                        <span>{sacrificio.total_rejected} rechazados</span>
                        {sacrificio.total_faltantes > 0 && (
                          <span className="text-amber-600 dark:text-amber-400">
                            {sacrificio.total_faltantes} faltantes ⚠
                          </span>
                        )}
                      </div>
                      {sacrificio.profiles?.full_name && (
                        <p className="text-xs text-muted-foreground">
                          Por: {sacrificio.profiles.full_name}
                        </p>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatDateDisplay(sacrificio.event_date)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
