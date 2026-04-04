import { ArrowLeftIcon } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { LimpiezaForm } from "../components/LimpiezaForm";
import { useCleaningProductTypes } from "../hooks/useCleaningProductTypes";
import { useCreateLimpieza } from "../hooks/useCreateLimpieza";

export function CreateLimpiezaPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [] } = usePools(farmId);
  const { data: productTypes = [] } = useCleaningProductTypes();
  const createLimpieza = useCreateLimpieza(farmId);

  const listPath = ROUTES.LIMPIEZA.replace(":farmId", farmId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Volver a limpiezas"
          onClick={() => navigate(listPath)}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-bold">Registrar Limpieza</h1>
      </div>

      <LimpiezaForm
        pools={pools}
        cleaningProductTypes={productTypes}
        isLoading={createLimpieza.isPending}
        onSubmit={(input) => {
          createLimpieza.mutate(input, {
            onSuccess: () => {
              toast.success("Limpieza registrada exitosamente");
              navigate(listPath);
            },
            onError: (err) => {
              toast.error(
                err instanceof Error ? err.message : "Error al registrar la limpieza"
              );
            },
          });
        }}
      />
    </div>
  );
}
