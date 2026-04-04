import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { usePools } from "@/features/farms/hooks/usePools";
import { ROUTES } from "@/shared/constants/routes";
import { SacrificioForm } from "../components/SacrificioForm";
import { useCreateSacrificio } from "../hooks/useCreateSacrificio";

export function CreateSacrificioPage() {
  const { farmId = "" } = useParams<{ farmId: string }>();
  const navigate = useNavigate();
  const { data: pools = [], isLoading: poolsLoading, isError: poolsError } = usePools(farmId);
  const createSacrificio = useCreateSacrificio(farmId);

  const listPath = ROUTES.SACRIFICIOS.replace(":farmId", farmId);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo Sacrificio</h1>
        <p className="text-sm text-muted-foreground">
          Registra el proceso de sacrificio de una pileta
        </p>
      </div>
      {poolsError && <p className="text-sm text-destructive">Error al cargar piletas.</p>}
      {poolsLoading ? (
        <p className="text-sm text-muted-foreground">Cargando piletas...</p>
      ) : (
        <SacrificioForm
          pools={pools}
          isLoading={createSacrificio.isPending}
          onSubmit={({ input, loteId, loteTotal }) => {
            createSacrificio.mutate(
              { input, loteId, loteTotal },
              {
                onSuccess: () => {
                  toast.success("Sacrificio registrado");
                  navigate(listPath);
                },
                onError: (err) => {
                  toast.error(err instanceof Error ? err.message : "Error al registrar sacrificio");
                },
              }
            );
          }}
        />
      )}
    </div>
  );
}
