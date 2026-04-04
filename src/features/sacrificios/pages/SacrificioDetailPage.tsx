import { ArrowLeftIcon } from "lucide-react";
import { useMemo } from "react";
import { Link, useParams } from "react-router";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { SacrificioDetail } from "../components/SacrificioDetail";
import { useSacrificioDetail } from "../hooks/useSacrificioDetail";

export function SacrificioDetailPage() {
  const { farmId = "", sacrificioId = "" } = useParams<{
    farmId: string;
    sacrificioId: string;
  }>();
  const { data: sacrificio, isLoading, isError } = useSacrificioDetail(sacrificioId);
  const { data: pools = [] } = usePools(farmId);

  const poolNames = useMemo(() => new Map(pools.map((p) => [p.id, p.name])), [pools]);

  const listPath = ROUTES.SACRIFICIOS.replace(":farmId", farmId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando detalle...</p>
      </div>
    );
  }

  if (isError || !sacrificio || sacrificio.farm_id !== farmId) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-destructive">No se encontró el sacrificio.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link to={listPath}>
          <Button variant="ghost" size="icon-sm">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Detalle de Sacrificio</h1>
          <p className="text-sm text-muted-foreground">Vista completa del evento</p>
        </div>
      </div>
      <SacrificioDetail sacrificio={sacrificio} poolNames={poolNames} />
    </div>
  );
}
