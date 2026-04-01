import { ArrowLeftIcon } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/constants/routes";
import { EntradaForm } from "../components/EntradaForm";
import { useCreateEntrada } from "../hooks/useCreateEntrada";

export function CreateEntradaPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [] } = usePools(farmId);
  const createEntrada = useCreateEntrada(farmId);

  const entradasPath = ROUTES.ENTRADAS.replace(":farmId", farmId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link to={entradasPath}>
          <Button variant="ghost" size="icon-sm" aria-label="Volver a entradas">
            <ArrowLeftIcon className="size-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-bold">Nueva Entrada</h1>
      </div>

      <EntradaForm
        farmId={farmId}
        pools={pools}
        isLoading={createEntrada.isPending}
        onSubmit={({ input, avalFile }) => {
          createEntrada.mutate(
            { input, avalFile },
            {
              onSuccess: () => {
                toast.success("Entrada registrada exitosamente");
                navigate(entradasPath);
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : "Error al registrar la entrada");
              },
            }
          );
        }}
      />
    </div>
  );
}
