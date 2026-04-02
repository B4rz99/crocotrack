import { ArrowLeftIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { MortalidadForm } from "../components/MortalidadForm";
import { useCreateMortalidad } from "../hooks/useCreateMortalidad";

export function CreateMortalidadPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [] } = usePools(farmId);
  const createMortalidad = useCreateMortalidad(farmId);

  const listPath = ROUTES.MORTALIDAD.replace(":farmId", farmId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={listPath}>
          <Button variant="ghost" size="icon-sm" aria-label="Volver a mortalidades">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Registrar Mortalidad</h1>
      </div>

      <MortalidadForm
        pools={pools}
        isLoading={createMortalidad.isPending}
        onSubmit={({ input, loteId }) => {
          createMortalidad.mutate(
            { input, loteId },
            {
              onSuccess: () => {
                toast.success("Mortalidad registrada exitosamente");
                navigate(listPath);
              },
              onError: (err) => {
                toast.error(
                  err instanceof Error ? err.message : "Error al registrar la mortalidad"
                );
              },
            }
          );
        }}
      />
    </div>
  );
}
