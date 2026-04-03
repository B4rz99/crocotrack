import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { ROUTES } from "@/shared/constants/routes";
import type { CreateTrasladoInput } from "@/shared/schemas/traslado.schema";
import { TrasladoForm } from "../components/TrasladoForm";
import { useCreateTraslado } from "../hooks/useCreateTraslado";

export function CreateTrasladoPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [], isLoading: poolsLoading } = usePools(farmId);
  const { mutate, isPending } = useCreateTraslado(farmId);

  function handleSubmit({ input, loteId }: { input: CreateTrasladoInput; loteId: string }) {
    mutate(
      { input, loteId },
      {
        onSuccess: () => {
          toast.success("Traslado registrado");
          navigate(ROUTES.TRASLADOS.replace(":farmId", farmId));
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Error al registrar traslado");
        },
      }
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo Traslado</h1>
        <p className="text-sm text-muted-foreground">Mueve animales entre piletas de crianza</p>
      </div>
      {poolsLoading ? (
        <p className="text-sm text-muted-foreground">Cargando piletas...</p>
      ) : (
        <TrasladoForm pools={pools} isLoading={isPending} onSubmit={handleSubmit} />
      )}
    </div>
  );
}
