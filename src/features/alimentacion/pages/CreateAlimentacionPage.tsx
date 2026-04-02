import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { AlimentacionForm } from "../components/AlimentacionForm";
import { useCreateAlimentacion } from "../hooks/useCreateAlimentacion";
import { useFoodStock } from "../hooks/useFoodStock";
import { useFoodTypes } from "../hooks/useFoodTypes";

export function CreateAlimentacionPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [] } = usePools(farmId);
  const { data: foodTypes = [] } = useFoodTypes();
  const { data: foodStock = [] } = useFoodStock(farmId);
  const createAlimentacion = useCreateAlimentacion(farmId);

  const listPath = ROUTES.ALIMENTACION.replace(":farmId", farmId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a alimentaciones"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Registrar Alimentacion</h1>
      </div>

      <AlimentacionForm
        pools={pools}
        foodTypes={foodTypes}
        foodStock={foodStock}
        isLoading={createAlimentacion.isPending}
        onSubmit={(input) => {
          createAlimentacion.mutate(input, {
            onSuccess: () => {
              toast.success("Alimentacion registrada exitosamente");
              navigate(listPath);
            },
            onError: (err) => {
              toast.error(
                err instanceof Error ? err.message : "Error al registrar la alimentacion"
              );
            },
          });
        }}
      />
    </div>
  );
}
