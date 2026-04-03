import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { ClasificacionForm } from "../components/ClasificacionForm";
import { useCreateClasificacion } from "../hooks/useCreateClasificacion";

export function CreateClasificacionPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [] } = usePools(farmId);
  const createClasificacion = useCreateClasificacion(farmId);

  const listPath = ROUTES.CLASIFICACION.replace(":farmId", farmId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a clasificaciones"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Registrar Clasificación</h1>
      </div>

      <ClasificacionForm
        pools={pools}
        isLoading={createClasificacion.isPending}
        onSubmit={({ input, loteId }) => {
          createClasificacion.mutate(
            { input, loteId },
            {
              onSuccess: ({ pending }) => {
                if (pending) {
                  toast.info(
                    "Clasificación guardada localmente. Se sincronizará cuando haya conexión."
                  );
                } else {
                  toast.success("Clasificación registrada exitosamente");
                }
                navigate(listPath);
              },
              onError: (err) => {
                toast.error(
                  err instanceof Error ? err.message : "Error al registrar la clasificación"
                );
              },
            }
          );
        }}
      />
    </div>
  );
}
